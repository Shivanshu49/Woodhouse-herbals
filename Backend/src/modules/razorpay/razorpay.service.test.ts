/**
 * Tests for RazorpayService.initiate (plan §1.1[2], §1.2 Option A) and the
 * webhook verification helper. NO settlement logic exists in this phase.
 *
 * Run: npx tsx --test src/modules/razorpay/razorpay.service.test.ts
 */

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { OrderStatus, Prisma } from '@prisma/client';
import { resetEnvCacheForTests } from '../../common/config/env';
import { RazorpayHttpError } from './razorpay.client';
import { RazorpayService } from './razorpay.service';

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://x:x@localhost:5432/x';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(64);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(64);
  process.env.RAZORPAY_KEY_ID = 'rzp_test_keyid';
  process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
  delete process.env.RAZORPAY_WEBHOOK_SECRET_OLD;
  resetEnvCacheForTests();
});

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

interface FakeCfg {
  order?: Record<string, unknown> | null;
  existingInitiated?: { id: string; providerTxnId: string; createdAt: Date } | null;
  paymentCreateThrows?: unknown;
  clientThrows?: boolean;
  clientStatus?: number;
}

function makeService(cfg: FakeCfg) {
  const calls = {
    paymentCreates: [] as any[],
    paymentUpdateManys: [] as any[],
    clientCreates: [] as any[],
    paymentFindFirsts: [] as any[],
  };
  let findFirstCall = 0;
  const prisma = {
    order: { findUnique: async () => cfg.order ?? null },
    payment: {
      findFirst: async (args: any) => {
        calls.paymentFindFirsts.push(args);
        findFirstCall++;
        // After a P2002 race the service re-reads: return the winner row.
        if (cfg.paymentCreateThrows && findFirstCall > 1) {
          return { id: 'winner', providerTxnId: 'order_WINNER', createdAt: new Date() };
        }
        return cfg.existingInitiated ?? null;
      },
      create: async (args: any) => {
        if (cfg.paymentCreateThrows) throw cfg.paymentCreateThrows;
        calls.paymentCreates.push(args);
        return { id: 'payrow_1', ...args.data };
      },
      updateMany: async (args: any) => {
        calls.paymentUpdateManys.push(args);
        return { count: 1 };
      },
    },
  };
  const client = {
    isConfigured: () => true,
    createOrder: async (input: any) => {
      calls.clientCreates.push(input);
      if (cfg.clientThrows) {
        if (cfg.clientStatus) throw new RazorpayHttpError(cfg.clientStatus, 'order create');
        throw new Error('Razorpay order create failed');
      }
      return { id: 'order_NEW', raw: { id: 'order_NEW' } };
    },
  };
  const svc = new RazorpayService(prisma as never, client as never);
  return { svc, calls };
}

const ORDER = {
  id: 'order_1',
  number: 'WH-ABC123',
  userId: 'user_1',
  cartSessionId: 'sess_1',
  status: OrderStatus.PENDING,
  totalMinor: 49900,
};

test('initiate: 503 when Razorpay keys are unset (the MSG91/Cloudinary pattern)', async () => {
  const { svc } = makeService({ order: ORDER });
  (svc as unknown as { client: { isConfigured: () => boolean } }).client.isConfigured = () => false;
  await assert.rejects(
    () => svc.initiate({ orderNumber: 'WH-ABC123', userId: 'user_1' }),
    ServiceUnavailableException,
  );
});

test('initiate: unknown order and non-owner both mask as 404', async () => {
  const { svc: missing } = makeService({ order: null });
  await assert.rejects(
    () => missing.initiate({ orderNumber: 'WH-ABC123', userId: 'user_1' }),
    NotFoundException,
  );
  const { svc: stranger } = makeService({ order: ORDER });
  await assert.rejects(
    () => stranger.initiate({ orderNumber: 'WH-ABC123', userId: 'someone_else' }),
    NotFoundException,
  );
});

test('initiate (Option A): a GUEST with the matching cart-session cookie owns the order', async () => {
  const { svc, calls } = makeService({ order: ORDER });
  const res = await svc.initiate({ orderNumber: 'WH-ABC123', sessionId: 'sess_1' });
  assert.equal(res.razorpayOrderId, 'order_NEW');
  assert.equal(calls.clientCreates.length, 1);
});

test('initiate (Option A): a guest with the WRONG session is a 404, same as a stranger', async () => {
  const { svc } = makeService({ order: ORDER });
  await assert.rejects(
    () => svc.initiate({ orderNumber: 'WH-ABC123', sessionId: 'other_sess' }),
    NotFoundException,
  );
});

test('initiate: an order that already left PENDING is a 409', async () => {
  const { svc } = makeService({ order: { ...ORDER, status: OrderStatus.PAID } });
  await assert.rejects(
    () => svc.initiate({ orderNumber: 'WH-ABC123', userId: 'user_1' }),
    ConflictException,
  );
});

test('initiate: rejects a server-derived total below 100 paise before provider IO', async () => {
  const { svc, calls } = makeService({ order: { ...ORDER, totalMinor: 99 } });
  await assert.rejects(
    () => svc.initiate({ orderNumber: 'WH-ABC123', userId: 'user_1' }),
    BadRequestException,
  );
  assert.equal(calls.clientCreates.length, 0);
});

test('initiate: MINT — server-side rzp order with amount from Order.totalMinor, receipt ≤40 w/ order-number prefix', async () => {
  const { svc, calls } = makeService({ order: ORDER });
  const res = await svc.initiate({ orderNumber: 'WH-ABC123', userId: 'user_1' });

  assert.equal(calls.clientCreates.length, 1);
  const create = calls.clientCreates[0];
  assert.equal(create.amountMinor, 49900); // server-side, never client-supplied
  assert.match(create.receipt, /^WH-ABC123-[A-Za-z0-9]{1,8}$/);
  assert.ok(create.receipt.length <= 40);
  assert.deepEqual(create.notes, { orderNumber: 'WH-ABC123' });

  // Payment row persisted BEFORE any webhook can arrive (Appendix B / §3).
  const row = calls.paymentCreates[0].data;
  assert.equal(row.orderId, 'order_1');
  assert.equal(row.provider, 'razorpay'); // explicit — the DB default is gone (§2a)
  assert.equal(row.providerTxnId, 'order_NEW');
  assert.equal(row.amountMinor, 49900);
  assert.equal(row.status, 'INITIATED');

  assert.deepEqual(res, {
    keyId: 'rzp_test_keyid',
    razorpayOrderId: 'order_NEW',
    amountMinor: 49900,
    currency: 'INR',
    orderNumber: 'WH-ABC123',
  });
});

test('initiate: REUSE — a fresh INITIATED row returns its rzp order id with NO provider call and NO new row', async () => {
  const { svc, calls } = makeService({
    order: ORDER,
    existingInitiated: { id: 'payrow_0', providerTxnId: 'order_OLD', createdAt: new Date() },
  });
  const res = await svc.initiate({ orderNumber: 'WH-ABC123', userId: 'user_1' });
  assert.equal(res.razorpayOrderId, 'order_OLD');
  assert.equal(calls.clientCreates.length, 0);
  assert.equal(calls.paymentCreates.length, 0);
});

test('initiate: SUPERSEDE — a stale INITIATED row (inside the TTL−2h margin) is CAS-FAILED, then a fresh mint', async () => {
  const staleCreatedAt = new Date(Date.now() - 23 * 3_600_000); // 23h old, 24h TTL
  const { svc, calls } = makeService({
    order: ORDER,
    existingInitiated: { id: 'payrow_0', providerTxnId: 'order_OLD', createdAt: staleCreatedAt },
  });
  const res = await svc.initiate({ orderNumber: 'WH-ABC123', userId: 'user_1' });
  // Old row superseded via CAS (only if still INITIATED — never clobber a settle).
  assert.deepEqual(calls.paymentUpdateManys[0].where, { id: 'payrow_0', status: 'INITIATED' });
  assert.equal(calls.paymentUpdateManys[0].data.status, 'FAILED');
  assert.equal(res.razorpayOrderId, 'order_NEW');
});

test('initiate: the P2002 double-mint race loser re-reads and returns the WINNER rzp order id', async () => {
  const { svc, calls } = makeService({ order: ORDER, paymentCreateThrows: p2002() });
  const res = await svc.initiate({ orderNumber: 'WH-ABC123', userId: 'user_1' });
  assert.equal(res.razorpayOrderId, 'order_WINNER');
  assert.ok(calls.paymentFindFirsts.length >= 2, 'must re-read after the unique violation');
});

test('initiate: provider order-create failure maps to 500 (order stays PENDING, retryable)', async () => {
  const { svc, calls } = makeService({ order: ORDER, clientThrows: true });
  await assert.rejects(
    () => svc.initiate({ orderNumber: 'WH-ABC123', userId: 'user_1' }),
    InternalServerErrorException,
  );
  assert.equal(calls.paymentCreates.length, 0, 'no row without an rzp order id');
});

test('initiate: Razorpay authentication failure maps to 401', async () => {
  const { svc, calls } = makeService({ order: ORDER, clientThrows: true, clientStatus: 401 });
  await assert.rejects(
    () => svc.initiate({ orderNumber: 'WH-ABC123', userId: 'user_1' }),
    UnauthorizedException,
  );
  assert.equal(calls.paymentCreates.length, 0);
});

// ── webhook verification helper (shell only — no settlement) ────────────────

test('verifyWebhook: valid signature true, tampered false, 503 when the secret is unset', () => {
  const { svc } = makeService({});
  const body = '{"event":"payment.captured"}';
  const sig = createHmac('sha256', 'whsec_test').update(body).digest('hex');
  assert.equal(svc.verifyWebhook(body, sig), true);
  assert.equal(svc.verifyWebhook('{"event":"payment.failed"}', sig), false);

  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  resetEnvCacheForTests();
  assert.throws(() => svc.verifyWebhook(body, sig), ServiceUnavailableException);
});

test('verifyWebhook: the rotation window accepts old-secret signatures when SECRET_OLD is set', () => {
  process.env.RAZORPAY_WEBHOOK_SECRET_OLD = 'whsec_previous';
  resetEnvCacheForTests();
  const { svc } = makeService({});
  const body = '{"event":"refund.processed"}';
  const oldSig = createHmac('sha256', 'whsec_previous').update(body).digest('hex');
  assert.equal(svc.verifyWebhook(body, oldSig), true);
});
