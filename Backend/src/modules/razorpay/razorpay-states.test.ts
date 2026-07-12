/**
 * Tests for Razorpay entity-state → internal-action mapping (plan §1.1[5],
 * §1.3, §3; Appendix B-3/B-4).
 *
 * Two invariants rule this module:
 *  - decisions key on payload ENTITY STATUS, never on webhook event names or
 *    arrival order ("the webhook sequence is not fixed"; payment.authorized
 *    can arrive already carrying status 'captured');
 *  - refund mapping ports the never-guess policy from refund-transitions.ts:
 *    unknown states park PENDING; only definitive provider rejections FAIL.
 *
 * Run: npx tsx --test src/modules/razorpay/razorpay-states.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { decidePaymentEntityAction, mapRazorpayRefundState } from './razorpay-states';

const EXPECTED = { amountMinor: 49900, rzpOrderId: 'order_ABC' };

const entity = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'pay_1',
  status: 'captured',
  amount: 49900,
  order_id: 'order_ABC',
  ...overrides,
});

// ── payment entity → action ─────────────────────────────────────────────────

test('captured + amount + order match ⇒ settle-success (regardless of which event carried it)', () => {
  assert.deepEqual(decidePaymentEntityAction(entity(), EXPECTED), {
    action: 'settle-success',
    providerPaymentId: 'pay_1',
  });
});

test('captured with an amount mismatch ⇒ anomaly hold, never auto-fail (money may have moved)', () => {
  assert.deepEqual(decidePaymentEntityAction(entity({ amount: 100 }), EXPECTED), {
    action: 'amount-mismatch-hold',
    providerPaymentId: 'pay_1',
  });
});

test('captured for a DIFFERENT rzp order ⇒ ignore-mismatched-order (routing error, log only)', () => {
  assert.deepEqual(decidePaymentEntityAction(entity({ order_id: 'order_OTHER' }), EXPECTED), {
    action: 'ignore-mismatched-order',
    providerPaymentId: 'pay_1',
  });
});

test('failed ⇒ annotate only — failed→captured on the same payment is documented expected behavior', () => {
  assert.deepEqual(decidePaymentEntityAction(entity({ status: 'failed' }), EXPECTED), {
    action: 'annotate-failed',
    providerPaymentId: 'pay_1',
  });
});

test('authorized (not yet captured) ⇒ no money action', () => {
  assert.deepEqual(decidePaymentEntityAction(entity({ status: 'authorized' }), EXPECTED), {
    action: 'ignore-authorized',
    providerPaymentId: 'pay_1',
  });
});

test('unknown/unmodeled status ⇒ ignore-unknown (ack, log, never guess)', () => {
  assert.equal(
    decidePaymentEntityAction(entity({ status: 'disputed' }), EXPECTED).action,
    'ignore-unknown',
  );
});

// ── refund status (+ S2S outcome) → internal RefundStatus ───────────────────

test('processed ⇒ PROCESSED (terminal)', () => {
  assert.equal(mapRazorpayRefundState('processed'), 'PROCESSED');
});

test('failed ⇒ FAILED (terminal — releases the payment)', () => {
  assert.equal(mapRazorpayRefundState('failed'), 'FAILED');
});

test('pending ⇒ PENDING (keep polling / awaiting webhook)', () => {
  assert.equal(mapRazorpayRefundState('pending'), 'PENDING');
});

test("unknown status (e.g. the webhook-docs 'reversed') parks PENDING — never guessed", () => {
  assert.equal(mapRazorpayRefundState('reversed'), 'PENDING');
});

test('5xx outcome with a non-terminal status stays PENDING (transient — recheck later)', () => {
  assert.equal(mapRazorpayRefundState('unknown', { httpStatus: 502 }), 'PENDING');
});

test('definitive 4xx rejection ⇒ FAILED (releases the payment for retry)', () => {
  assert.equal(mapRazorpayRefundState('unknown', { httpStatus: 400 }), 'FAILED');
});

test("errorCode BAD_REQUEST_ERROR ⇒ FAILED even without an http status", () => {
  assert.equal(mapRazorpayRefundState('unknown', { errorCode: 'BAD_REQUEST_ERROR' }), 'FAILED');
});

test('an explicit terminal status wins over a contradictory transport outcome', () => {
  // Ported semantic from refund-transitions.test.ts:51 — data.state is the
  // strongest evidence; a 500 alongside an explicit terminal state must not
  // downgrade it to PENDING.
  assert.equal(mapRazorpayRefundState('processed', { httpStatus: 500 }), 'PROCESSED');
  assert.equal(mapRazorpayRefundState('failed', { httpStatus: 500 }), 'FAILED');
});
