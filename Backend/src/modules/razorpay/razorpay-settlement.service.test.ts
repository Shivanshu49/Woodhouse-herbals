/**
 * Pinning tests for the SINGLE settlement door (plan §1.1[5]/§1.3; CP3
 * attacks #1–#5 each named below). Every money write shape is asserted
 * exactly — these tests are the mutation targets for the CP3 CAS drills.
 *
 * Run: npx tsx --test src/modules/razorpay/razorpay-settlement.service.test.ts
 */

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { resetEnvCacheForTests } from '../../common/config/env';
import { RazorpaySettlementService } from './razorpay-settlement.service';

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://x:x@localhost:5432/x';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(64);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(64);
  process.env.RAZORPAY_KEY_ID = 'rzp_test_keyid';
  process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
  resetEnvCacheForTests();
});

interface Cfg {
  paymentRow?: Record<string, unknown> | null;
  /** payment.updateMany result inside the settle tx (the INITIATED CAS). */
  initiatedCasCount?: number;
  /** payment status returned by the re-read in recoverNonInitiated. */
  reReadStatus?: string | null;
  /** payment.updateMany result for the FAILED→SUCCESS recovery CAS. */
  recoveryCasCount?: number;
  /** order.updateMany result (PENDING→PAID CAS). */
  orderCasCount?: number;
  refundRow?: { id: string; orderId: string; status: string } | null;
  /** prisma.payment.findFirst hit for the provider-refund-unmatched lookup. */
  paymentByProviderPaymentId?: { id: string; orderId: string } | null;
  existingMismatchEvent?: boolean;
  orderRow?: Record<string, unknown> | null;
  fetchedEntity?: Record<string, unknown>;
  fetchThrows?: boolean;
}

function makeService(cfg: Cfg) {
  const calls = {
    paymentUpdateManys: [] as any[],
    orderUpdateManys: [] as any[],
    events: [] as any[],
    refundSettles: [] as any[],
    cartLineDeletes: [] as any[],
    fetchPayments: [] as any[],
  };
  const tx = {
    payment: {
      updateMany: async (args: any) => {
        calls.paymentUpdateManys.push(args);
        const isRecovery = args.where.status === 'FAILED';
        return { count: isRecovery ? (cfg.recoveryCasCount ?? 1) : (cfg.initiatedCasCount ?? 1) };
      },
    },
    order: {
      updateMany: async (args: any) => {
        calls.orderUpdateManys.push(args);
        return { count: cfg.orderCasCount ?? 1 };
      },
    },
    cart: { findUnique: async () => ({ id: 'cart_1' }) },
    cartLine: {
      deleteMany: async (args: any) => {
        calls.cartLineDeletes.push(args);
        return { count: 1 };
      },
    },
  };
  const prisma = {
    payment: {
      findUnique: async (args: any) => {
        // The settle path looks up by providerTxnId; the recovery re-read by id.
        if (args.where.id) {
          return cfg.reReadStatus === null ? null : { status: cfg.reReadStatus ?? 'FAILED' };
        }
        // Respect the lookup key: an entity for a different rzp order finds
        // NOTHING (the row is keyed by providerTxnId) — that is the real
        // first line of the order_id guard.
        if (args.where.providerTxnId !== (cfg.paymentRow as any)?.providerTxnId) return null;
        return cfg.paymentRow ?? null;
      },
      findFirst: async () => cfg.paymentByProviderPaymentId ?? null,
      updateMany: tx.payment.updateMany,
    },
    order: {
      findUnique: async (args: any) => {
        if (args.select?.status && !args.select?.userId) return { status: 'PAID' };
        return cfg.orderRow ?? null;
      },
      updateMany: tx.order.updateMany,
    },
    orderEvent: {
      findFirst: async () => (cfg.existingMismatchEvent ? { id: 'evt_prior' } : null),
    },
    refund: { findFirst: async () => cfg.refundRow ?? null },
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
  const events = {
    record: async (input: unknown) => {
      calls.events.push(input);
    },
  };
  const refunds = {
    settle: async (...args: unknown[]) => {
      calls.refundSettles.push(args);
    },
  };
  const client = {
    fetchPayment: async (id: string) => {
      calls.fetchPayments.push(id);
      if (cfg.fetchThrows) throw new Error('unreachable');
      return cfg.fetchedEntity ?? CAPTURED;
    },
  };
  const svc = new RazorpaySettlementService(
    prisma as never,
    events as never,
    refunds as never,
    client as never,
  );
  return { svc, calls };
}

const PAYMENT_ROW = {
  id: 'payrow_1',
  orderId: 'order_db_1',
  amountMinor: 49900,
  providerTxnId: 'order_A',
  status: 'INITIATED',
  order: { id: 'order_db_1', cartSessionId: 'sess_1' },
};

const CAPTURED = { id: 'pay_1', status: 'captured', amount: 49900, order_id: 'order_A' };

// ── CP3 attack #1: no settlement without the FULL guard, and no second door ──

test('ATTACK#1: captured with wrong AMOUNT settles nothing anywhere — anomaly event only', async () => {
  const { svc, calls } = makeService({ paymentRow: PAYMENT_ROW });
  const outcome = await svc.processPaymentEntity({ ...CAPTURED, amount: 100 });
  assert.equal(outcome, 'amount-mismatch-held');
  assert.equal(calls.paymentUpdateManys.length, 0, 'no payment write on mismatch');
  assert.equal(calls.orderUpdateManys.length, 0);
  assert.equal(calls.events[0].type, 'payment_amount_mismatch');
  assert.equal(calls.events[0].meta.expectedMinor, 49900);
  assert.equal(calls.events[0].meta.capturedMinor, 100);
});

test('ATTACK#1: an entity for a DIFFERENT rzp order settles nothing (guard includes order_id)', async () => {
  const { svc, calls } = makeService({ paymentRow: PAYMENT_ROW });
  const outcome = await svc.processPaymentEntity({ ...CAPTURED, order_id: 'order_OTHER' });
  // The row lookup is BY providerTxnId, so a mismatched entity can only reach
  // this row through a bug — and the guard still refuses it.
  assert.equal(outcome, 'unknown-payment');
  assert.equal(calls.paymentUpdateManys.length, 0);
});

test('ATTACK#1: the verify fast-path settles through the SAME door — a mismatched fetch holds, never settles', async () => {
  const { svc, calls } = makeService({
    paymentRow: PAYMENT_ROW,
    orderRow: { id: 'order_db_1', userId: 'user_1', cartSessionId: 'sess_1', status: 'PENDING' },
    fetchedEntity: { ...CAPTURED, amount: 100 }, // API says a different amount
  });
  const sig = createHmac('sha256', 'rzp_test_secret').update('order_A|pay_1').digest('hex');
  const res = await svc.verifyFastPath({
    orderNumber: 'WH-ABC123',
    userId: 'user_1',
    razorpayOrderId: 'order_A',
    razorpayPaymentId: 'pay_1',
    razorpaySignature: sig,
  });
  assert.equal(res.outcome, 'amount-mismatch-held');
  assert.equal(calls.paymentUpdateManys.length, 0, 'verify has no private settle path');
  assert.equal(calls.events[0].type, 'payment_amount_mismatch');
});

test('ATTACK#1: a valid checkout signature alone NEVER settles — the API fetch is the authority', async () => {
  const { svc, calls } = makeService({
    paymentRow: PAYMENT_ROW,
    orderRow: { id: 'order_db_1', userId: 'user_1', cartSessionId: 'sess_1', status: 'PENDING' },
    fetchThrows: true, // API unreachable ⇒ the hint stays a hint
  });
  const sig = createHmac('sha256', 'rzp_test_secret').update('order_A|pay_1').digest('hex');
  const res = await svc.verifyFastPath({
    orderNumber: 'WH-ABC123',
    userId: 'user_1',
    razorpayOrderId: 'order_A',
    razorpayPaymentId: 'pay_1',
    razorpaySignature: sig,
  });
  assert.equal(res.outcome, 'provider-unreachable');
  assert.equal(calls.paymentUpdateManys.length, 0);
});

// ── CP3 attack #2: the CAS shapes (mutation targets) ─────────────────────────

test('ATTACK#2: the happy settle pins the payment CAS shape {id, status:INITIATED} → SUCCESS + providerPaymentId', async () => {
  const { svc, calls } = makeService({ paymentRow: PAYMENT_ROW });
  const outcome = await svc.processPaymentEntity(CAPTURED);
  assert.equal(outcome, 'settled');
  const cas = calls.paymentUpdateManys[0];
  assert.deepEqual(cas.where, { id: 'payrow_1', status: 'INITIATED' });
  assert.equal(cas.data.status, 'SUCCESS');
  assert.equal(cas.data.providerPaymentId, 'pay_1');
  const orderCas = calls.orderUpdateManys[0];
  assert.deepEqual(orderCas.where, { id: 'order_db_1', status: 'PENDING' });
  assert.equal(orderCas.data.status, 'PAID');
  assert.equal(calls.events[0].type, 'status_changed');
  assert.equal(calls.cartLineDeletes.length, 1, 'cart cleared on settle');
});

// ── CP3 attack #3: captured_after_abandon ───────────────────────────────────

test('ATTACK#3: capture on an ABANDONED payment recovers FAILED→SUCCESS, persists the anomaly, order stays CANCELLED, NO restock anywhere', async () => {
  const { svc, calls } = makeService({
    paymentRow: PAYMENT_ROW,
    initiatedCasCount: 0, // the INITIATED CAS finds the row already FAILED
    reReadStatus: 'FAILED',
    recoveryCasCount: 1,
    orderCasCount: 0, // order is CANCELLED — must NOT advance
  });
  const outcome = await svc.processPaymentEntity(CAPTURED);
  assert.equal(outcome, 'captured-after-abandon');
  const recovery = calls.paymentUpdateManys.find((c) => c.where.status === 'FAILED');
  assert.deepEqual(recovery.where, { id: 'payrow_1', status: 'FAILED' });
  assert.equal(recovery.data.status, 'SUCCESS');
  const anomaly = calls.events.find((e) => e.type === 'captured_after_abandon');
  assert.ok(anomaly, 'anomaly must be a PERSISTED order-event');
  assert.equal(anomaly.meta.orderAdvanced, false);
  // Restock is not this service's business in ANY branch — the abandonment
  // already restocked, and restockApplies skips CANCELLED on a later refund.
  assert.equal('adjust' in calls, false);
});

test('ATTACK#3: capture on a SUPERSEDED row with the order still PENDING advances it (legitimate payment)', async () => {
  const { svc, calls } = makeService({
    paymentRow: PAYMENT_ROW,
    initiatedCasCount: 0,
    reReadStatus: 'FAILED',
    recoveryCasCount: 1,
    orderCasCount: 1, // order still PENDING
  });
  const outcome = await svc.processPaymentEntity(CAPTURED);
  assert.equal(outcome, 'captured-after-supersede-paid');
  const anomaly = calls.events.find((e) => e.type === 'captured_after_abandon');
  assert.equal(anomaly.meta.orderAdvanced, true);
});

test('ATTACK#3: the SUCCESS/REFUNDED re-read path no-ops (duplicate delivery)', async () => {
  for (const status of ['SUCCESS', 'REFUNDED', 'REFUND_PENDING']) {
    const { svc, calls } = makeService({
      paymentRow: PAYMENT_ROW,
      initiatedCasCount: 0,
      reReadStatus: status,
    });
    const outcome = await svc.processPaymentEntity(CAPTURED);
    assert.equal(outcome, 'already-terminal', status);
    assert.equal(calls.events.length, 0, `no event for duplicate on ${status}`);
    assert.equal(
      calls.paymentUpdateManys.filter((c) => c.where.status === 'FAILED').length,
      0,
      'no recovery CAS attempted',
    );
  }
});

// ── paid_on_non_pending is PERSISTED ─────────────────────────────────────────

test('paid_on_non_pending: payment settles, order refuses to resurrect, anomaly is a PERSISTED event', async () => {
  const { svc, calls } = makeService({ paymentRow: PAYMENT_ROW, orderCasCount: 0 });
  const outcome = await svc.processPaymentEntity(CAPTURED);
  assert.equal(outcome, 'settled');
  const anomaly = calls.events.find((e) => e.type === 'paid_on_non_pending');
  assert.ok(anomaly, 'must persist, never log-only');
  assert.equal(calls.cartLineDeletes.length, 0, 'no cart clear on a non-advanced order');
});

// ── CP3 attack #5: late failed never clobbers capture evidence ───────────────

test('ATTACK#5: failed-annotation is CAS-gated on INITIATED and never writes providerPaymentId', async () => {
  const { svc, calls } = makeService({ paymentRow: PAYMENT_ROW });
  const outcome = await svc.processPaymentEntity({ ...CAPTURED, id: 'pay_failed', status: 'failed' });
  assert.equal(outcome, 'annotated-failed');
  const write = calls.paymentUpdateManys[0];
  assert.deepEqual(write.where, { id: 'payrow_1', status: 'INITIATED' });
  assert.equal('providerPaymentId' in write.data, false, 'failed path must never set providerPaymentId');
  assert.equal('status' in write.data, false, 'failed path never changes status — cron owns abandonment');
});

// ── refund routing + tripwire ────────────────────────────────────────────────

test('refund processed → RefundsService.settle(PROCESSED) with the provider refund id', async () => {
  const { svc, calls } = makeService({
    refundRow: { id: 'refund_1', orderId: 'order_db_1', status: 'PENDING' },
  });
  const outcome = await svc.processRefundEntity({
    id: 'rfnd_1',
    status: 'processed',
    amount: 49900,
    payment_id: 'pay_1',
    receipt: 'RFrefund1',
  });
  assert.equal(outcome, 'refund-processed');
  assert.equal(calls.refundSettles[0][0], 'refund_1');
  assert.equal(calls.refundSettles[0][1], 'PROCESSED');
  assert.equal(calls.refundSettles[0][2], 'rfnd_1');
});

test("refund 'reversed'/unknown parks PENDING through settle (never guessed terminal)", async () => {
  const { svc, calls } = makeService({
    refundRow: { id: 'refund_1', orderId: 'order_db_1', status: 'PENDING' },
  });
  await svc.processRefundEntity({
    id: 'rfnd_1',
    status: 'reversed',
    amount: 49900,
    payment_id: 'pay_1',
  });
  assert.equal(calls.refundSettles[0][1], 'PENDING');
});

test('MIRROR TRIPWIRE: a regression status (failed/reversed) on a refund already PROCESSED persists refund_regressed_after_processed and does NOT settle', async () => {
  for (const status of ['failed', 'reversed']) {
    const { svc, calls } = makeService({
      refundRow: { id: 'refund_1', orderId: 'order_db_1', status: 'PROCESSED' },
    });
    const outcome = await svc.processRefundEntity({
      id: 'rfnd_1',
      status,
      amount: 49900,
      payment_id: 'pay_1',
      receipt: 'RFrefund1',
    });
    assert.equal(outcome, 'refund-regressed-after-processed', status);
    assert.equal(calls.refundSettles.length, 0, 'a settled-PROCESSED refund is not re-settled');
    assert.equal(calls.events[0].type, 'refund_regressed_after_processed');
  }
});

test('a plain pending redelivery on a PROCESSED refund is NOT a regression anomaly (no noise)', async () => {
  const { svc, calls } = makeService({
    refundRow: { id: 'refund_1', orderId: 'order_db_1', status: 'PROCESSED' },
  });
  await svc.processRefundEntity({
    id: 'rfnd_1',
    status: 'pending',
    amount: 49900,
    payment_id: 'pay_1',
    receipt: 'RFrefund1',
  });
  assert.equal(calls.events.length, 0, "a stale 'pending' redelivery is not a books contradiction");
});

test('TRIPWIRE: provider PROCESSED on a refund we concluded FAILED persists refund_settled_after_conclude and does NOT settle', async () => {
  const { svc, calls } = makeService({
    refundRow: { id: 'refund_1', orderId: 'order_db_1', status: 'FAILED' },
  });
  const outcome = await svc.processRefundEntity({
    id: 'rfnd_1',
    status: 'processed',
    amount: 49900,
    payment_id: 'pay_1',
    receipt: 'RFrefund1',
  });
  assert.equal(outcome, 'refund-settled-after-conclude');
  assert.equal(calls.refundSettles.length, 0, 'books contradiction is surfaced, not auto-resolved');
  assert.equal(calls.events[0].type, 'refund_settled_after_conclude');
});

test('unknown payment / truly-foreign refund ack quietly (never make the provider retry forever)', async () => {
  const { svc: s1, calls: c1 } = makeService({ paymentRow: null });
  assert.equal(await s1.processPaymentEntity(CAPTURED), 'unknown-payment');
  assert.equal(c1.paymentUpdateManys.length, 0);
  const { svc: s2, calls: c2 } = makeService({ refundRow: null, paymentByProviderPaymentId: null });
  assert.equal(
    await s2.processRefundEntity({ id: 'rfnd_x', status: 'processed', amount: 1, payment_id: 'p' }),
    'unknown-refund',
  );
  assert.equal(c2.refundSettles.length, 0);
  assert.equal(c2.events.length, 0, 'a refund that matches NONE of our payments stays log-only');
});

test('REVIEW-FIX: a dashboard refund of OUR payment persists provider_refund_unmatched — never log-only money', async () => {
  const { svc, calls } = makeService({
    refundRow: null,
    paymentByProviderPaymentId: { id: 'payrow_1', orderId: 'order_db_1' },
  });
  const outcome = await svc.processRefundEntity({
    id: 'rfnd_dash',
    status: 'processed',
    amount: 49900,
    payment_id: 'pay_1',
  });
  assert.equal(outcome, 'provider-refund-unmatched');
  const anomaly = calls.events.find((e) => e.type === 'provider_refund_unmatched');
  assert.ok(anomaly, 'money that left the merchant balance must have a book entry');
  assert.equal(anomaly.meta.providerRefundId, 'rfnd_dash');
  assert.equal(calls.refundSettles.length, 0, 'no Refund row is invented');
});

test('REVIEW-FIX: the recovery race-loser (FAILED CAS count 0) no-ops without a duplicate anomaly event', async () => {
  const { svc, calls } = makeService({
    paymentRow: PAYMENT_ROW,
    initiatedCasCount: 0,
    reReadStatus: 'FAILED',
    recoveryCasCount: 0, // another recovery won the FAILED→SUCCESS race
  });
  const outcome = await svc.processPaymentEntity(CAPTURED);
  assert.equal(outcome, 'already-terminal');
  assert.equal(calls.events.length, 0, 'the winner persisted the anomaly; the loser must not duplicate it');
});

test('REVIEW-FIX: a supersede-advance recovery clears the backend cart, mirroring settleSuccess', async () => {
  const { svc, calls } = makeService({
    paymentRow: PAYMENT_ROW,
    initiatedCasCount: 0,
    reReadStatus: 'FAILED',
    recoveryCasCount: 1,
    orderCasCount: 1,
  });
  await svc.processPaymentEntity(CAPTURED);
  assert.equal(calls.cartLineDeletes.length, 1, 'both roads to PAID clear the cart');
});

// ── verify fast-path guards ──────────────────────────────────────────────────

test('verify: ownership masks as 404; bad signature is a 400; foreign tuple is a 400', async () => {
  const base = {
    orderRow: { id: 'order_db_1', userId: 'user_1', cartSessionId: 'sess_1', status: 'PENDING' },
    paymentRow: PAYMENT_ROW,
  };
  const sig = createHmac('sha256', 'rzp_test_secret').update('order_A|pay_1').digest('hex');
  const input = {
    orderNumber: 'WH-ABC123',
    razorpayOrderId: 'order_A',
    razorpayPaymentId: 'pay_1',
    razorpaySignature: sig,
  };

  const { svc: stranger } = makeService(base);
  await assert.rejects(() => stranger.verifyFastPath({ ...input, userId: 'someone_else' }), NotFoundException);

  const { svc: badSig } = makeService(base);
  await assert.rejects(
    () => badSig.verifyFastPath({ ...input, userId: 'user_1', razorpaySignature: 'a'.repeat(64) }),
    BadRequestException,
  );

  // Tuple belonging to a different order's payment row → 400.
  const { svc: foreign } = makeService({
    ...base,
    paymentRow: { ...PAYMENT_ROW, orderId: 'order_db_OTHER' },
  });
  await assert.rejects(() => foreign.verifyFastPath({ ...input, userId: 'user_1' }), BadRequestException);
});

test('mismatch anomaly dedupe: a SEQUENTIAL second observation does not duplicate the event (best-effort — the concurrent-distinct-delivery race is accepted as timeline noise, review cluster G)', async () => {
  const { svc, calls } = makeService({ paymentRow: PAYMENT_ROW, existingMismatchEvent: true });
  await svc.processPaymentEntity({ ...CAPTURED, amount: 100 });
  assert.equal(calls.events.length, 0, 'second observation does not duplicate the event');
});
