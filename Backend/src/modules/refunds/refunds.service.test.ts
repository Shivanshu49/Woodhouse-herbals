/**
 * Pinning tests for the refund money path (Razorpay migration Phase 0).
 *
 * These characterize the provider-AGNOSTIC orchestration in RefundsService —
 * the exactly-once CAS claims, P2002→409 mapping, provider-failure honesty,
 * idempotent settle, and the one-physical-return restock matrix — BEFORE the
 * provider client is swapped. The provider client is stubbed via the existing
 * constructor injection; Prisma is a hand-rolled fake that records calls.
 *
 * Run: npx tsx --test src/modules/refunds/refunds.service.test.ts
 */

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ConflictException } from '@nestjs/common';
import { OrderStatus, Prisma, RefundDisposition } from '@prisma/client';
import { resetEnvCacheForTests } from '../../common/config/env';
import { RefundsService } from './refunds.service';
import type { RefundCreateResult } from '../razorpay/razorpay.client';

// ── env fixture (the service reads env.ADMIN_WRITE_TX_TIMEOUT_MS; the lazy
//    proxy validates the WHOLE schema on first read) ─────────────────────────
beforeEach(() => {
  // Hard-assign (never ??=): a developer shell exporting NODE_ENV=production
  // or short secrets must not leak in — env.ts computed its prod strictness
  // (minSecret=64) at module load, so the fixture secrets are 64 chars to be
  // valid under EITHER mode, and NODE_ENV is pinned so the prod refine block
  // (which would demand PhonePe creds and exit(1)) never runs.
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://x:x@localhost:5432/x';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(64);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(64);
  resetEnvCacheForTests();
});

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

// ── configurable fakes ───────────────────────────────────────────────────────

interface Calls {
  orderFindUniques: any[];
  refundCreates: any[];
  refundUpdates: any[];
  refundUpdateManys: any[];
  paymentUpdates: any[];
  paymentUpdateManys: any[];
  orderUpdates: any[];
  adjusts: any[];
  events: any[];
  createRefunds: any[];
  fetchRefunds: any[];
  listRefundCalls: any[];
}

interface FakeConfig {
  order?: Record<string, unknown> | null;
  /** result of the initiate CAS tx.payment.updateMany */
  paymentCasCount?: number;
  /** throw from tx.refund.create (e.g. p2002()) */
  refundCreateThrows?: unknown;
  /** result of the settle claim tx.refund.updateMany */
  settleClaimCount?: number;
  /** row returned by tx.refund.findUnique inside settle */
  settleRefundRow?: { orderId: string; paymentId: string | null; status?: string } | null;
  /** createRefund outcome; default = accepted-async {ok, status:'pending'} */
  createRefund?: () => RefundCreateResult;
  createRefundThrows?: boolean;
  /** fetchRefund(providerRefundId) result; undefined = null (absent) */
  fetchRefund?: { id: string; status: string } | null;
  fetchRefundThrows?: boolean;
  /** listRefundsForPayment result */
  listRefunds?: Array<{ id: string; status: string; receipt?: string | null }>;
  listRefundsThrows?: boolean;
  /** row returned by prisma.refund.findFirst (recheck lookup) */
  pendingRefundRow?: Record<string, unknown> | null;
}

function makeService(cfg: FakeConfig) {
  const calls: Calls = {
    orderFindUniques: [],
    refundCreates: [],
    refundUpdates: [],
    refundUpdateManys: [],
    paymentUpdates: [],
    paymentUpdateManys: [],
    orderUpdates: [],
    adjusts: [],
    events: [],
    createRefunds: [],
    fetchRefunds: [],
    listRefundCalls: [],
  };

  const tx = {
    refund: {
      create: async (args: any) => {
        if (cfg.refundCreateThrows) throw cfg.refundCreateThrows;
        calls.refundCreates.push(args);
        return { id: 'refund_1', status: args.data.status };
      },
      update: async (args: any) => {
        calls.refundUpdates.push(args);
        return {};
      },
      updateMany: async (args: any) => {
        calls.refundUpdateManys.push(args);
        return { count: cfg.settleClaimCount ?? 1 };
      },
      findUnique: async () => cfg.settleRefundRow ?? null,
    },
    orderEvent: {
      findFirst: async () => null, // tripwire dedupe: no prior anomaly event
    },
    payment: {
      update: async (args: any) => {
        calls.paymentUpdates.push(args);
        return {};
      },
      updateMany: async (args: any) => {
        calls.paymentUpdateManys.push(args);
        return { count: cfg.paymentCasCount ?? 1 };
      },
    },
    order: {
      update: async (args: any) => {
        calls.orderUpdates.push(args);
        return {};
      },
    },
  };

  const prisma = {
    order: {
      findUnique: async (args: any) => {
        calls.orderFindUniques.push(args);
        return cfg.order ?? null;
      },
    },
    refund: {
      findFirst: async () => cfg.pendingRefundRow ?? null,
      updateMany: async (args: any) => {
        calls.refundUpdateManys.push(args);
        return { count: 1 };
      },
    },
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };

  const events = {
    record: async (input: unknown) => {
      calls.events.push(input);
    },
  };
  const inventory = {
    adjust: async (input: unknown) => {
      calls.adjusts.push(input);
    },
  };
  const razorpay = {
    createRefund: async (input: unknown) => {
      calls.createRefunds.push(input);
      if (cfg.createRefundThrows) throw new Error('ETIMEDOUT');
      if (cfg.createRefund) return cfg.createRefund();
      return {
        outcome: 'ok',
        refund: { id: 'rfnd_new', status: 'pending', amount: 49900, payment_id: 'rzp_pay_1' },
        httpStatus: 200,
      } as RefundCreateResult;
    },
    fetchRefund: async (id: string) => {
      calls.fetchRefunds.push(id);
      if (cfg.fetchRefundThrows) throw new Error('ETIMEDOUT');
      return cfg.fetchRefund ?? null;
    },
    listRefundsForPayment: async (id: string) => {
      calls.listRefundCalls.push(id);
      if (cfg.listRefundsThrows) throw new Error('ETIMEDOUT');
      return cfg.listRefunds ?? [];
    },
  };

  const svc = new RefundsService(
    prisma as never,
    events as never,
    inventory as never,
    razorpay as never,
  );
  return { svc, calls };
}

const ITEMS = [
  { productId: 'p1', quantity: 2 },
  { productId: 'p2', quantity: 1 },
];

function prepaidOrder(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'order_1',
    number: 'WH-ABC123',
    status: OrderStatus.DELIVERED,
    totalMinor: 49900,
    userId: 'user_1',
    items: ITEMS,
    payments: [{ id: 'pay_1', providerTxnId: 'order_A', providerPaymentId: 'rzp_pay_1' }],
    refunds: [],
    ...overrides,
  };
}

function codOrder(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'order_1',
    number: 'WH-ABC123',
    status: OrderStatus.DELIVERED,
    totalMinor: 49900,
    items: ITEMS,
    payments: [], // no SUCCESS payment ⇒ COD
    refunds: [],
    ...overrides,
  };
}

const MANUAL_DTO = {
  utrReference: 'UTR123456',
  disposition: RefundDisposition.RETURNED,
  reason: 'test',
};

// ── initiate: exactly-once gates ────────────────────────────────────────────

test('initiate: losing the payment CAS (count 0) maps to 409, creates no refund row', async () => {
  const { svc, calls } = makeService({ order: prepaidOrder(), paymentCasCount: 0 });
  await assert.rejects(
    () => svc.initiate('order_1', { disposition: RefundDisposition.RETURNED } as never, 'admin_1'),
    ConflictException,
  );
  assert.equal(calls.refundCreates.length, 0);
  assert.equal(calls.createRefunds.length, 0, 'provider must never be called on a lost CAS');
});

test('initiate: P2002 from the partial unique index maps to 409', async () => {
  const { svc, calls } = makeService({ order: prepaidOrder(), refundCreateThrows: p2002() });
  await assert.rejects(
    () => svc.initiate('order_1', { disposition: RefundDisposition.RETURNED } as never, 'admin_1'),
    ConflictException,
  );
  assert.equal(calls.createRefunds.length, 0);
});

test('initiate: a non-FAILED existing refund is a 409 before any write', async () => {
  const { svc, calls } = makeService({
    order: prepaidOrder({ refunds: [{ status: 'PENDING', disposition: 'RETURNED' }] }),
  });
  await assert.rejects(
    () => svc.initiate('order_1', { disposition: RefundDisposition.RETURNED } as never, 'admin_1'),
    ConflictException,
  );
  assert.equal(calls.paymentUpdateManys.length, 0);
});

test('initiate: provider throw leaves the persisted intent PENDING (never guesses success)', async () => {
  const { svc, calls } = makeService({
    order: prepaidOrder(),
    createRefundThrows: true,
  });
  const res = await svc.initiate(
    'order_1',
    { disposition: RefundDisposition.RETURNED } as never,
    'admin_1',
  );
  assert.deepEqual(res, { id: 'refund_1', status: 'PENDING' });
  // Intent WAS persisted before the provider call…
  assert.equal(calls.refundCreates.length, 1);
  // …and no settle transition ran (the only refund.updateMany calls allowed are
  // the merchantRefundId backfill-style updates, never a status write).
  const statusWrites = calls.refundUpdateManys.filter((a) => a?.data?.status);
  assert.equal(statusWrites.length, 0);
});

test('initiate: unrefundable order status (PAID) is rejected before the money tx', async () => {
  const { svc, calls } = makeService({ order: prepaidOrder({ status: OrderStatus.PAID }) });
  await assert.rejects(
    () => svc.initiate('order_1', { disposition: RefundDisposition.RETURNED } as never, 'admin_1'),
    ConflictException,
  );
  assert.equal(calls.paymentUpdateManys.length, 0);
});

test('initiate happy path: pins every money-critical write shape', async () => {
  const { svc, calls } = makeService({ order: prepaidOrder() });
  const res = await svc.initiate(
    'order_1',
    { disposition: RefundDisposition.RETURNED } as never,
    'admin_1',
  );

  // The order lookup filters payments to SUCCESS — the COD-vs-online
  // discriminator lives in the QUERY, not in JS.
  assert.equal(calls.orderFindUniques[0].select.payments.where.status, 'SUCCESS');

  // Payment CAS: SUCCESS → REFUND_PENDING on exactly the found payment.
  assert.deepEqual(calls.paymentUpdateManys[0].where, { id: 'pay_1', status: 'SUCCESS' });
  assert.deepEqual(calls.paymentUpdateManys[0].data, { status: 'REFUND_PENDING' });

  // Refund row: full order amount (totalMinor, never subtotal), PENDING,
  // gateway method, linked to the payment, actor recorded.
  const created = calls.refundCreates[0].data;
  assert.equal(created.amountMinor, 49900);
  assert.equal(created.status, 'PENDING');
  assert.equal(created.method, 'GATEWAY');
  assert.equal(created.paymentId, 'pay_1');
  assert.equal(created.actorId, 'admin_1');

  // Deterministic merchant refund id derived from the row id — the retry
  // dedupe / recheck handle (and the receipt/idempotency key under Razorpay).
  assert.deepEqual(calls.refundUpdates[0].where, { id: 'refund_1' });
  assert.equal(calls.refundUpdates[0].data.merchantRefundId, 'RFrefund1');

  // Provider call: the pay_… id, the deterministic key as BOTH header and
  // receipt (CP4 attack #4: idempotency header + receipt + partial index
  // compose to exactly-once), and the explicit full-order amount.
  assert.deepEqual(calls.createRefunds[0], {
    paymentId: 'rzp_pay_1',
    idempotencyKey: 'RFrefund1',
    receipt: 'RFrefund1',
    amountMinor: 49900,
    notes: { orderNumber: 'WH-ABC123' },
  });

  // The accepted-async entity's provider id is persisted no-clobber.
  const idBackfill = calls.refundUpdateManys.find((c) => c.data?.providerRefundId);
  assert.deepEqual(idBackfill.where, { id: 'refund_1', providerRefundId: null });
  assert.equal(idBackfill.data.providerRefundId, 'rfnd_new');

  // Restock-at-initiation for RETURNED, audited per item on the order number.
  assert.equal(calls.adjusts.length, ITEMS.length);
  assert.equal(calls.adjusts[0].reason, 'RETURNED');
  assert.equal(calls.adjusts[0].reference, 'WH-ABC123');

  // refund_issued event; accepted-async provider response reports PENDING.
  assert.equal(calls.events[0].type, 'refund_issued');
  assert.deepEqual(res, { id: 'refund_1', status: 'PENDING' });
});

test('initiate: a SUCCESS payment without providerPaymentId (PhonePe-era row) is a 409, provider never called', async () => {
  const { svc, calls } = makeService({
    order: prepaidOrder({
      payments: [{ id: 'pay_1', providerTxnId: 'TXN_PHONEPE', providerPaymentId: null }],
    }),
  });
  await assert.rejects(
    () => svc.initiate('order_1', { disposition: RefundDisposition.RETURNED } as never, 'admin_1'),
    ConflictException,
  );
  assert.equal(calls.createRefunds.length, 0);
});

test('initiate: a definitive 4xx from the create is adopted as FAILED — the payment is RELEASED', async () => {
  const { svc, calls } = makeService({
    order: prepaidOrder(),
    createRefund: () =>
      ({ outcome: 'definitive-4xx', httpStatus: 400, errorCode: 'BAD_REQUEST_ERROR' }) as never,
    settleClaimCount: 1,
    settleRefundRow: { orderId: 'order_1', paymentId: 'pay_1' },
  });
  const res = await svc.initiate(
    'order_1',
    { disposition: RefundDisposition.RETURNED } as never,
    'admin_1',
  );
  assert.equal(res.status, 'FAILED');
  const claim = calls.refundUpdateManys.find((c) => c.data?.status === 'FAILED');
  assert.ok(claim, 'the FAILED settle claim ran');
  const release = calls.paymentUpdates.find((c) => c.data.status === 'SUCCESS');
  assert.ok(release, 'REFUND_PENDING released back to SUCCESS for retry');
});

test('initiate: a 409-in-flight create outcome stays PENDING with NO settle writes', async () => {
  const { svc, calls } = makeService({
    order: prepaidOrder(),
    createRefund: () => ({ outcome: 'in-flight-409', httpStatus: 409 }) as never,
  });
  const res = await svc.initiate(
    'order_1',
    { disposition: RefundDisposition.RETURNED } as never,
    'admin_1',
  );
  assert.equal(res.status, 'PENDING');
  assert.equal(calls.refundUpdateManys.filter((c) => c.data?.status).length, 0);
});

// ── settle: idempotent single money-state transition ────────────────────────

test('settle: PENDING is a no-op (not terminal)', async () => {
  const { svc, calls } = makeService({});
  await svc.settle('refund_1', 'PENDING');
  assert.equal(calls.refundUpdateManys.length, 0);
});

test('TRIPWIRE (in-claim): a terminal PROCESSED losing the claim to a FAILED conclude persists refund_settled_after_conclude ATOMICALLY', async () => {
  // The adversarial review's TOCTOU: a caller-side pre-read misses the
  // concurrent processed-vs-failed race. The tripwire therefore lives INSIDE
  // settle's no-op branch (plan §3 item 4) — the blocked claim guarantees
  // the concurrent FAILED writer committed, so the re-read sees it.
  const { svc, calls } = makeService({
    settleClaimCount: 0,
    settleRefundRow: { orderId: 'order_1', paymentId: 'pay_1', status: 'FAILED' },
  });
  await svc.settle('refund_1', 'PROCESSED', 'rfnd_provider_1');
  assert.equal(calls.paymentUpdates.length, 0, 'no money writes on a lost claim');
  assert.equal(calls.orderUpdates.length, 0);
  const tripwire = calls.events.find((e: any) => e.type === 'refund_settled_after_conclude');
  assert.ok(tripwire, 'books contradiction must be persisted, never silently dropped');
  assert.equal(tripwire.meta.refundId, 'refund_1');
});

test('TRIPWIRE (in-claim): a lost claim on a non-FAILED row (already PROCESSED) stays a silent no-op', async () => {
  const { svc, calls } = makeService({
    settleClaimCount: 0,
    settleRefundRow: { orderId: 'order_1', paymentId: 'pay_1', status: 'PROCESSED' },
  });
  await svc.settle('refund_1', 'PROCESSED', 'rfnd_provider_1');
  assert.equal(calls.events.length, 0, 'duplicate terminal delivery is not an anomaly');
});

test('settle: losing the PENDING-claim races to a silent no-op', async () => {
  const { svc, calls } = makeService({
    settleClaimCount: 0,
    settleRefundRow: { orderId: 'order_1', paymentId: 'pay_1' },
  });
  await svc.settle('refund_1', 'PROCESSED');
  assert.equal(calls.paymentUpdates.length, 0);
  assert.equal(calls.orderUpdates.length, 0);
  assert.equal(calls.events.length, 0);
});

test('settle PROCESSED: payment → REFUNDED, order → REFUNDED, refund_settled event', async () => {
  const { svc, calls } = makeService({
    settleClaimCount: 1,
    settleRefundRow: { orderId: 'order_1', paymentId: 'pay_1' },
  });
  await svc.settle('refund_1', 'PROCESSED', 'provider_ref_1');
  // Pin the CLAIM SHAPE itself — the `status: 'PENDING'` filter IS the
  // idempotency guard (a claim without it would let a late duplicate
  // webhook re-settle a terminal refund). The Razorpay swap must keep
  // this verbatim (plan §3).
  const claim = calls.refundUpdateManys[0];
  assert.deepEqual(claim.where, { id: 'refund_1', status: 'PENDING' });
  assert.equal(claim.data.status, 'PROCESSED');
  assert.equal(claim.data.providerRefundId, 'provider_ref_1');
  assert.equal(calls.paymentUpdates[0].data.status, 'REFUNDED');
  assert.equal(calls.orderUpdates[0].data.status, OrderStatus.REFUNDED);
  assert.equal(calls.events[0].type, 'refund_settled');
});

test('settle FAILED: releases the payment back to SUCCESS, order untouched, refund_failed event', async () => {
  const { svc, calls } = makeService({
    settleClaimCount: 1,
    settleRefundRow: { orderId: 'order_1', paymentId: 'pay_1' },
  });
  await svc.settle('refund_1', 'FAILED');
  assert.equal(calls.paymentUpdates[0].data.status, 'SUCCESS');
  assert.equal(calls.orderUpdates.length, 0, 'FAILED must never touch order status');
  assert.equal(calls.events[0].type, 'refund_failed');
});

test('settle FAILED on a COD refund (no paymentId) skips the payment write', async () => {
  const { svc, calls } = makeService({
    settleClaimCount: 1,
    settleRefundRow: { orderId: 'order_1', paymentId: null },
  });
  await svc.settle('refund_1', 'FAILED');
  assert.equal(calls.paymentUpdates.length, 0);
});

// ── manual (COD) path + the restock matrix ──────────────────────────────────

test('manual: COD refund on DELIVERED + RETURNED restocks every item with reason RETURNED', async () => {
  const { svc, calls } = makeService({ order: codOrder() });
  const res = await svc.manual('order_1', MANUAL_DTO as never, 'admin_1');
  assert.equal(res.status, 'PROCESSED');
  assert.equal(calls.adjusts.length, ITEMS.length);
  assert.equal(calls.adjusts[0].reason, 'RETURNED');
  assert.equal(calls.adjusts[0].delta, 2);
  assert.equal(calls.orderUpdates[0].data.status, OrderStatus.REFUNDED);
});

test('manual: refunding a CANCELLED order never restocks (cancel already did)', async () => {
  const { svc, calls } = makeService({ order: codOrder({ status: OrderStatus.CANCELLED }) });
  await svc.manual('order_1', MANUAL_DTO as never, 'admin_1');
  assert.equal(calls.adjusts.length, 0);
});

test('manual: a prior RETURNED refund (even FAILED) suppresses restock on retry', async () => {
  const { svc, calls } = makeService({
    order: codOrder({ refunds: [{ disposition: RefundDisposition.RETURNED }] }),
  });
  await svc.manual('order_1', MANUAL_DTO as never, 'admin_1');
  assert.equal(calls.adjusts.length, 0);
});

test('manual: a prior NON-RETURNED refund does not suppress a RETURNED restock', async () => {
  // Only a prior RETURNED refund means the goods already came back; a prior
  // DAMAGED/LOST attempt must not block the restock of a genuine return.
  const { svc, calls } = makeService({
    order: codOrder({ refunds: [{ disposition: RefundDisposition.DAMAGED }] }),
  });
  await svc.manual('order_1', MANUAL_DTO as never, 'admin_1');
  assert.equal(calls.adjusts.length, ITEMS.length);
});

test('manual: the COD guard reads a SUCCESS-filtered payments relation', async () => {
  const { svc, calls } = makeService({ order: codOrder() });
  await svc.manual('order_1', MANUAL_DTO as never, 'admin_1');
  // The "was this paid online?" discriminator is the QUERY filter — a FAILED
  // online attempt must not make a COD order un-refundable.
  assert.equal(calls.orderFindUniques[0].select.payments.where.status, 'SUCCESS');
});

test('manual: DAMAGED disposition never restocks (unsellable goods)', async () => {
  const { svc, calls } = makeService({ order: codOrder() });
  await svc.manual(
    'order_1',
    { ...MANUAL_DTO, disposition: RefundDisposition.DAMAGED } as never,
    'admin_1',
  );
  assert.equal(calls.adjusts.length, 0);
});

test('manual: rejected with 409 when a SUCCESS online payment exists (must use gateway path)', async () => {
  const { svc, calls } = makeService({
    order: codOrder({ payments: [{ id: 'pay_1' }] }),
  });
  await assert.rejects(() => svc.manual('order_1', MANUAL_DTO as never, 'admin_1'), ConflictException);
  assert.equal(calls.refundCreates.length, 0);
});

test('manual: P2002 double-submit maps to 409, not a double payout', async () => {
  const { svc } = makeService({ order: codOrder(), refundCreateThrows: p2002() });
  await assert.rejects(() => svc.manual('order_1', MANUAL_DTO as never, 'admin_1'), ConflictException);
});

// ── §3 recovery routine (recheck / Phase-6 sweep) — CP4 attack pins ──────────

const OLD = new Date(Date.now() - 60 * 60_000); // 60 min — past the conclude min-age
const YOUNG = new Date(Date.now() - 60_000); // 1 min — inside it

function pendingRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'refund_1',
    merchantRefundId: 'RFrefund1',
    providerRefundId: null,
    createdAt: OLD,
    amountMinor: 49900,
    payment: { providerPaymentId: 'rzp_pay_1' },
    ...overrides,
  };
}

test('ATTACK#2: with a persisted providerRefundId, the FRESH READ settles and the re-send is STRUCTURALLY unreachable', async () => {
  const { svc, calls } = makeService({
    pendingRefundRow: pendingRow({ providerRefundId: 'rfnd_1' }),
    fetchRefund: { id: 'rfnd_1', status: 'processed' },
    settleClaimCount: 1,
    settleRefundRow: { orderId: 'order_1', paymentId: 'pay_1' },
  });
  const res = await svc.recheck('order_1');
  assert.equal(res.state, 'PROCESSED');
  assert.deepEqual(calls.fetchRefunds, ['rfnd_1']);
  assert.equal(calls.createRefunds.length, 0, 'the stale-replay probe never runs when state was read');
  const claim = calls.refundUpdateManys.find((c) => c.data?.status === 'PROCESSED');
  assert.ok(claim, 'settled from the CURRENT provider status');
});

test('ATTACK#2: without a providerRefundId, the receipt-matched LIST is the fresh read — still no re-send', async () => {
  const { svc, calls } = makeService({
    pendingRefundRow: pendingRow(),
    listRefunds: [
      { id: 'rfnd_other', status: 'processed', receipt: 'RFsomeoneelse' },
      { id: 'rfnd_ours', status: 'failed', receipt: 'RFrefund1' },
    ],
    settleClaimCount: 1,
    settleRefundRow: { orderId: 'order_1', paymentId: 'pay_1' },
  });
  const res = await svc.recheck('order_1');
  assert.equal(res.state, 'FAILED');
  assert.deepEqual(calls.listRefundCalls, ['rzp_pay_1']);
  assert.equal(calls.createRefunds.length, 0);
  // The provider id learned from the read is persisted no-clobber.
  const backfill = calls.refundUpdateManys.find((c) => c.data?.providerRefundId === 'rfnd_ours');
  assert.deepEqual(backfill.where, { id: 'refund_1', providerRefundId: null });
});

test('ATTACK#1: a FAILED state read concludes NOTHING — no re-send, no settle, payment untouched', async () => {
  const { svc, calls } = makeService({
    pendingRefundRow: pendingRow({ providerRefundId: 'rfnd_1' }),
    fetchRefundThrows: true,
  });
  const res = await svc.recheck('order_1');
  assert.equal(res.state, 'PENDING');
  assert.equal(calls.createRefunds.length, 0, 'a failed read forbids the ambiguity probe');
  assert.equal(calls.refundUpdateManys.filter((c) => c.data?.status).length, 0);
  assert.equal(calls.paymentUpdates.length, 0);
});

test('ATTACK#1: TWO TIMEOUTS (empty read + re-send network failure) can NEVER release the payment', async () => {
  const { svc, calls } = makeService({
    pendingRefundRow: pendingRow(),
    listRefunds: [], // successful but empty read
    createRefundThrows: true, // the ambiguity probe times out
  });
  const res = await svc.recheck('order_1');
  assert.equal(res.state, 'PENDING');
  assert.equal(calls.refundUpdateManys.filter((c) => c.data?.status).length, 0);
  assert.equal(calls.paymentUpdates.length, 0, 'the payment CAS is never released on transient evidence');
});

test('ATTACK#1: empty read + TRANSIENT 5xx re-send also parks PENDING', async () => {
  const { svc, calls } = makeService({
    pendingRefundRow: pendingRow(),
    listRefunds: [],
    createRefund: () => ({ outcome: 'transient', httpStatus: 502 }) as never,
  });
  const res = await svc.recheck('order_1');
  assert.equal(res.state, 'PENDING');
  assert.equal(calls.paymentUpdates.length, 0);
});

test('conclude-FAILED fires ONLY on positive evidence: successful empty list AND definitive 4xx re-send', async () => {
  const { svc, calls } = makeService({
    pendingRefundRow: pendingRow(),
    listRefunds: [],
    createRefund: () =>
      ({ outcome: 'definitive-4xx', httpStatus: 400, errorCode: 'BAD_REQUEST_ERROR' }) as never,
    settleClaimCount: 1,
    settleRefundRow: { orderId: 'order_1', paymentId: 'pay_1' },
  });
  const res = await svc.recheck('order_1');
  assert.equal(res.state, 'FAILED');
  const release = calls.paymentUpdates.find((c) => c.data.status === 'SUCCESS');
  assert.ok(release, 'positive evidence releases the payment for a retry');
  // The re-send used the SAME deterministic key (exactly-once at the provider).
  assert.equal(calls.createRefunds[0].idempotencyKey, 'RFrefund1');
  assert.equal(calls.createRefunds[0].receipt, 'RFrefund1');
});

test('conclude-FAILED is age-gated: the same positive evidence on a YOUNG refund parks PENDING', async () => {
  const { svc, calls } = makeService({
    pendingRefundRow: pendingRow({ createdAt: YOUNG }),
    listRefunds: [],
    createRefund: () =>
      ({ outcome: 'definitive-4xx', httpStatus: 400, errorCode: 'BAD_REQUEST_ERROR' }) as never,
  });
  const res = await svc.recheck('order_1');
  assert.equal(res.state, 'PENDING');
  assert.equal(calls.paymentUpdates.length, 0);
});

test('a REPLAYED re-send (creation proof) is adopted: pending parks, providerRefundId persisted', async () => {
  const { svc, calls } = makeService({
    pendingRefundRow: pendingRow(),
    listRefunds: [],
    createRefund: () =>
      ({
        outcome: 'ok',
        refund: { id: 'rfnd_replay', status: 'pending', amount: 49900, payment_id: 'rzp_pay_1' },
        httpStatus: 200,
      }) as never,
  });
  const res = await svc.recheck('order_1');
  assert.equal(res.state, 'PENDING', 'a stale-or-current pending parks; the NEXT read sees truth');
  const backfill = calls.refundUpdateManys.find((c) => c.data?.providerRefundId === 'rfnd_replay');
  assert.ok(backfill, 'the learned provider id arms the next run with a direct fetch handle');
});

test('duplicate-receipt CONTRADICTION (read said absent, provider says exists) never concludes', async () => {
  const { svc, calls } = makeService({
    pendingRefundRow: pendingRow(),
    listRefunds: [],
    createRefund: () =>
      ({
        outcome: 'definitive-4xx',
        httpStatus: 400,
        errorCode: 'BAD_REQUEST_ERROR',
        reason: 'duplicate_receipt',
        description: 'Duplicate receipt found for this refund request',
      }) as never,
  });
  const res = await svc.recheck('order_1');
  assert.equal(res.state, 'PENDING', 'contradictory evidence parks — the next read resolves it');
  assert.equal(calls.paymentUpdates.length, 0);
});
