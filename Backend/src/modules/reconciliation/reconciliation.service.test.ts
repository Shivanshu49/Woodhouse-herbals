/**
 * Tests for the reconciliation cron orchestration (plan §1.4; CP5 attacks).
 * The pure triage (decidePaymentSweep/decideRefundSweep) is pinned in
 * reconcile-decisions.test.ts; here we prove the ONE-DOOR delegation, the
 * batch cap, and the dead-man honesty. Every money action is a fake we can
 * assert was called with the right args — the service settles nothing itself.
 *
 * Run: npx tsx --test src/modules/reconciliation/reconciliation.service.test.ts
 */

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetEnvCacheForTests } from '../../common/config/env';
import { ReconciliationService } from './reconciliation.service';

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://x:x@localhost:5432/x';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(64);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(64);
  process.env.RECONCILE_PAYMENT_MIN_AGE_MIN = '15';
  process.env.PAYMENT_ABANDON_TTL_HOURS = '24';
  process.env.REFUND_CONCLUDE_MIN_AGE_MIN = '15';
  process.env.RECONCILE_ANOMALY_MAX_OBSERVATIONS = '3';
  resetEnvCacheForTests();
});

const OLD = () => new Date(Date.now() - 60 * 60_000); // 60 min old (past min-age)
const ANCIENT = () => new Date(Date.now() - 25 * 60 * 60_000); // 25 h (past TTL)

interface Cfg {
  paymentRows?: any[];
  refundRows?: any[];
  claimRows?: any[];
  attempts?: any[];
  fetchThrows?: boolean;
  mismatchEventCount?: number;
  processWebhookThrows?: boolean;
}

function makeService(cfg: Cfg) {
  const calls = {
    processPaymentEntity: [] as any[],
    abandonPayment: [] as any[],
    recoverPendingRefund: [] as any[],
    processWebhook: [] as any[],
    markProcessed: [] as string[],
    stamps: [] as any[],
  };
  const prisma = {
    payment: { findMany: async () => cfg.paymentRows ?? [] },
    refund: { findMany: async () => cfg.refundRows ?? [] },
    webhookEvent: { findMany: async () => cfg.claimRows ?? [] },
    orderEvent: { count: async () => cfg.mismatchEventCount ?? 0 },
    storeSetting: {
      upsert: async (args: any) => {
        calls.stamps.push(args);
        return {};
      },
    },
  };
  const settlement = {
    processPaymentEntity: async (entity: any) => {
      calls.processPaymentEntity.push(entity);
      return 'settled';
    },
    abandonPayment: async (input: any) => {
      calls.abandonPayment.push(input);
      return 'abandoned';
    },
    processWebhook: async (parsed: any) => {
      calls.processWebhook.push(parsed);
      if (cfg.processWebhookThrows) throw new Error('settle crash');
      return 'settled';
    },
  };
  const refunds = {
    recoverPendingRefund: async (input: any) => {
      calls.recoverPendingRefund.push(input);
      return { state: 'PENDING' };
    },
  };
  const client = {
    fetchOrderPayments: async (id: string) => {
      if (cfg.fetchThrows) throw new Error('unreachable');
      return cfg.attempts ?? [];
    },
  };
  const webhooks = {
    markProcessed: async (id: string) => {
      calls.markProcessed.push(id);
    },
  };
  const svc = new ReconciliationService(
    prisma as never,
    settlement as never,
    refunds as never,
    client as never,
    webhooks as never,
  );
  return { svc, calls };
}

const paymentRow = (o: Record<string, unknown> = {}) => ({
  id: 'payrow_1',
  providerTxnId: 'order_A',
  amountMinor: 49900,
  createdAt: OLD(),
  orderId: 'order_db_1',
  order: { number: 'WH-ABC123', items: [{ productId: 'p1', quantity: 2 }] },
  ...o,
});

const captured = { id: 'pay_1', status: 'captured', amount: 49900, order_id: 'order_A' };

// ── ONE-DOOR delegation (CP5 attack #1) ─────────────────────────────────────

test('ONE DOOR: a captured attempt is handed to settlement.processPaymentEntity — the sweep never settles itself', async () => {
  const { svc, calls } = makeService({
    paymentRows: [paymentRow()],
    attempts: [captured],
  });
  await svc.sweepPayments();
  assert.deepEqual(calls.processPaymentEntity, [captured], 'the captured entity goes to the door');
  assert.equal(calls.abandonPayment.length, 0);
});

test('ONE DOOR: a mismatched captured attempt ALSO goes to the door (it persists the hold, sweep does not)', async () => {
  const { svc, calls } = makeService({
    paymentRows: [paymentRow()],
    attempts: [{ ...captured, amount: 100 }],
  });
  await svc.sweepPayments();
  assert.equal(calls.processPaymentEntity.length, 1, 'the door decides settle-vs-hold, not the sweep');
  assert.equal(calls.abandonPayment.length, 0);
});

test('abandon: past the TTL with only failed attempts ⇒ settlement.abandonPayment with the order items + number', async () => {
  const { svc, calls } = makeService({
    paymentRows: [paymentRow({ createdAt: ANCIENT() })],
    attempts: [{ id: 'pay_x', status: 'failed', amount: 49900, order_id: 'order_A' }],
  });
  await svc.sweepPayments();
  assert.equal(calls.processPaymentEntity.length, 0);
  assert.deepEqual(calls.abandonPayment[0], {
    paymentId: 'payrow_1',
    orderId: 'order_db_1',
    orderNumber: 'WH-ABC123',
    items: [{ productId: 'p1', quantity: 2 }],
  });
});

test('authorized-stuck and anomaly-terminal take NO money action', async () => {
  const { svc: a, calls: ca } = makeService({
    paymentRows: [paymentRow({ createdAt: ANCIENT() })],
    attempts: [{ id: 'pay_x', status: 'authorized', amount: 49900, order_id: 'order_A' }],
  });
  await a.sweepPayments();
  assert.equal(ca.abandonPayment.length, 0, 'authorized may still capture — never abandon');
  assert.equal(ca.processPaymentEntity.length, 0);

  const { svc: b, calls: cb } = makeService({
    paymentRows: [paymentRow()],
    attempts: [{ ...captured, amount: 100 }],
    mismatchEventCount: 1, // already flagged ⇒ anomaly-terminal
  });
  await b.sweepPayments();
  assert.equal(cb.processPaymentEntity.length, 0, 'a flagged mismatch is not re-acted on');
  assert.equal(cb.abandonPayment.length, 0);
});

test('a provider fetch failure skips the row (never guesses) and does not abort the batch', async () => {
  const { svc, calls } = makeService({
    paymentRows: [paymentRow(), paymentRow({ id: 'payrow_2' })],
    fetchThrows: true,
  });
  await svc.sweepPayments();
  assert.equal(calls.processPaymentEntity.length, 0);
  assert.equal(calls.abandonPayment.length, 0);
  // The sweep still completed (dead-man stamps) — see the dead-man test.
});

// ── refunds sweep → the ONE recovery routine ────────────────────────────────

test('refunds sweep delegates each PENDING row to RefundsService.recoverPendingRefund with orderNumber threaded', async () => {
  const { svc, calls } = makeService({
    refundRows: [
      {
        id: 'refund_1',
        merchantRefundId: 'RFrefund1',
        providerRefundId: null,
        createdAt: OLD(),
        amountMinor: 49900,
        order: { number: 'WH-ABC123' },
        payment: { providerPaymentId: 'rzp_pay_1' },
      },
    ],
  });
  await svc.sweepRefunds();
  assert.deepEqual(calls.recoverPendingRefund[0], {
    id: 'refund_1',
    merchantRefundId: 'RFrefund1',
    providerRefundId: null,
    createdAt: calls.recoverPendingRefund[0].createdAt,
    amountMinor: 49900,
    providerPaymentId: 'rzp_pay_1',
    orderNumber: 'WH-ABC123',
  });
});

// ── unprocessed-claims re-drive (CP5 attack #4) ─────────────────────────────

test('re-drive replays a processed=false claim through the settle door THEN markProcessed', async () => {
  const payload = {
    entity: 'event',
    event: 'payment.captured',
    contains: ['payment'],
    payload: { payment: { entity: captured } },
  };
  const { svc, calls } = makeService({ claimRows: [{ id: 'evt_1', payload }] });
  await svc.sweepUnprocessedClaims();
  assert.equal(calls.processWebhook.length, 1);
  assert.equal(calls.processWebhook[0].kind, 'payment');
  assert.deepEqual(calls.markProcessed, ['evt_1'], 'the claim is burned only after the door succeeds');
});

test('re-drive: a settle throw leaves the claim UNPROCESSED (no markProcessed) for the next run', async () => {
  const payload = {
    entity: 'event',
    event: 'payment.captured',
    contains: ['payment'],
    payload: { payment: { entity: captured } },
  };
  const { svc, calls } = makeService({ claimRows: [{ id: 'evt_1', payload }], processWebhookThrows: true });
  await svc.sweepUnprocessedClaims();
  assert.equal(calls.markProcessed.length, 0, 'a crashed re-drive must not burn the claim');
});

// ── dead-man honesty (CP5 attack #6) ────────────────────────────────────────

test('dead-man: a COMPLETED sweep stamps last_completed_at', async () => {
  const { svc, calls } = makeService({ paymentRows: [] });
  await svc.reconcilePayments();
  assert.equal(calls.stamps.length, 1);
  assert.equal(calls.stamps[0].where.key, 'reconcile:payments:last_completed_at');
  assert.ok(typeof calls.stamps[0].create.value === 'string');
});

test('dead-man: a CRASHED sweep NEVER stamps (a dead-man that never lies)', async () => {
  const { svc, calls } = makeService({});
  // Force the sweep body to throw by making findMany reject.
  (svc as unknown as { prisma: any }).prisma = {
    payment: {
      findMany: async () => {
        throw new Error('DB down mid-sweep');
      },
    },
  };
  await assert.rejects(() => svc.reconcilePayments());
  assert.equal(calls.stamps.length, 0, 'the timestamp must not advance on a crash');
});

test('batch cap: findMany is asked for at most 50 rows', async () => {
  let takeArg: number | undefined;
  const { svc } = makeService({});
  (svc as unknown as { prisma: any }).prisma = {
    payment: {
      findMany: async (args: any) => {
        takeArg = args.take;
        return [];
      },
    },
    storeSetting: { upsert: async () => ({}) },
  };
  await svc.sweepPayments();
  assert.equal(takeArg, 50);
});
