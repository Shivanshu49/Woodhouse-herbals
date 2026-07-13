/**
 * Tests for the reconciliation cron's pure decision functions (plan §1.3,
 * §1.4, §3 — incl. the adversarial-review fixes: captured-after-abandon,
 * anomaly-hold terminal, positive-evidence conclude, reuse-if-fresh margin).
 *
 * The cron itself (Phase 6) is a thin wrapper: fetch → decide (here) → act
 * via the existing idempotent settle paths. Everything time-based takes
 * explicit inputs — no Date.now inside the functions.
 *
 * Run: npx tsx --test src/modules/reconciliation/reconcile-decisions.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decidePaymentSweep,
  decideRefundSweep,
  decideInitiateReuse,
} from './reconcile-decisions';

// ── payments sweep ───────────────────────────────────────────────────────────

const BASE = {
  paymentAgeMin: 30,
  minAgeMin: 15,
  abandonTtlHours: 24,
  expectedAmountMinor: 49900,
  expectedRzpOrderId: 'order_A',
};

const attempt = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'pay_1',
  status: 'failed',
  amount: 49900,
  order_id: 'order_A',
  ...overrides,
});

test('payments: younger than the sweep min-age ⇒ wait (webhooks get first shot)', () => {
  assert.deepEqual(decidePaymentSweep({ ...BASE, paymentAgeMin: 5, attempts: [] }), {
    action: 'wait',
  });
});

test('payments: a captured attempt passing the FULL settle guard ⇒ settle-success', () => {
  const decision = decidePaymentSweep({
    ...BASE,
    attempts: [attempt(), attempt({ id: 'pay_2', status: 'captured' })],
  });
  assert.deepEqual(decision, { action: 'settle-success', providerPaymentId: 'pay_2' });
});

test('payments: the settle guard is IDENTICAL to the webhook path — amount mismatch ⇒ anomaly-hold, not settle', () => {
  const decision = decidePaymentSweep({
    ...BASE,
    attempts: [attempt({ status: 'captured', amount: 100 })],
  });
  assert.deepEqual(decision, {
    action: 'anomaly-hold',
    reason: 'amount_mismatch',
    providerPaymentId: 'pay_1',
  });
});

// (The anomaly-hold terminal is no longer a numeric counter — CP5-REVISED.
// Once flagged, the cron's findMany excludes the order entirely; that
// exclusion is pinned in reconciliation.service.test.ts. The pure function
// therefore only ever emits anomaly-hold for a not-yet-flagged mismatch.)

test('payments: a mismatched captured attempt BLOCKS abandonment even past the TTL', () => {
  const decision = decidePaymentSweep({
    ...BASE,
    paymentAgeMin: 25 * 60, // past 24h TTL
    attempts: [attempt({ status: 'captured', amount: 100 })],
  });
  assert.equal(decision.action, 'anomaly-hold');
});

test('payments: a stuck authorized attempt ⇒ authorized-stuck (no money action), and blocks abandonment', () => {
  const past = decidePaymentSweep({
    ...BASE,
    paymentAgeMin: 25 * 60,
    attempts: [attempt({ status: 'authorized' })],
  });
  assert.deepEqual(past, { action: 'authorized-stuck', providerPaymentId: 'pay_1' });
});

test('payments: only failed/no attempts past the TTL ⇒ abandon (cancel + restock moves HERE)', () => {
  assert.deepEqual(
    decidePaymentSweep({ ...BASE, paymentAgeMin: 25 * 60, attempts: [attempt()] }),
    { action: 'abandon' },
  );
  assert.deepEqual(decidePaymentSweep({ ...BASE, paymentAgeMin: 25 * 60, attempts: [] }), {
    action: 'abandon',
  });
});

test('payments: past min-age but inside the TTL with no captured attempt ⇒ wait', () => {
  assert.deepEqual(decidePaymentSweep({ ...BASE, attempts: [attempt()] }), { action: 'wait' });
});

test('payments: attempt-list order is irrelevant — captured wins wherever it sits', () => {
  const attempts = [
    attempt({ id: 'pay_a', status: 'authorized' }),
    attempt({ id: 'pay_b', status: 'captured' }),
    attempt({ id: 'pay_c', status: 'failed' }),
  ];
  assert.deepEqual(decidePaymentSweep({ ...BASE, attempts }), {
    action: 'settle-success',
    providerPaymentId: 'pay_b',
  });
  assert.deepEqual(decidePaymentSweep({ ...BASE, attempts: [...attempts].reverse() }), {
    action: 'settle-success',
    providerPaymentId: 'pay_b',
  });
});

// ── refunds sweep (§3 recovery: fresh read primary, positive-evidence conclude) ──

const RBASE = { refundAgeMin: 30, concludeMinAgeMin: 15 };

test('refunds: younger than conclude min-age ⇒ wait', () => {
  const decision = decideRefundSweep({
    ...RBASE,
    refundAgeMin: 5,
    stateRead: { ok: true, matched: null },
    resend: { outcome: 'not-attempted' },
  });
  assert.deepEqual(decision, { action: 'wait' });
});

test('refunds: a fresh state read that finds the refund ⇒ settle from its CURRENT status', () => {
  const decision = decideRefundSweep({
    ...RBASE,
    stateRead: { ok: true, matched: { id: 'rfnd_1', status: 'failed' } },
    resend: { outcome: 'not-attempted' },
  });
  assert.deepEqual(decision, {
    action: 'settle-from-state',
    status: 'failed',
    providerRefundId: 'rfnd_1',
  });
});

test('refunds: an idempotent re-send REPLAY also yields state (creation-ambiguity resolution)', () => {
  const decision = decideRefundSweep({
    ...RBASE,
    stateRead: { ok: true, matched: null },
    resend: { outcome: 'replayed', refund: { id: 'rfnd_2', status: 'pending' } },
  });
  assert.deepEqual(decision, {
    action: 'settle-from-state',
    status: 'pending',
    providerRefundId: 'rfnd_2',
  });
});

test('refunds: conclude-FAILED requires BOTH a successful empty list AND a definitive 4xx re-send', () => {
  const decision = decideRefundSweep({
    ...RBASE,
    stateRead: { ok: true, matched: null },
    resend: { outcome: 'definitive-4xx' },
  });
  assert.deepEqual(decision, { action: 'conclude-failed' });
});

test('refunds: two timeouts can NEVER conclude — transient re-send stays waiting', () => {
  const decision = decideRefundSweep({
    ...RBASE,
    stateRead: { ok: true, matched: null },
    resend: { outcome: 'transient' },
  });
  assert.deepEqual(decision, { action: 'wait' });
});

test('refunds: a FAILED state read blocks any conclusion regardless of the re-send outcome', () => {
  const decision = decideRefundSweep({
    ...RBASE,
    stateRead: { ok: false },
    resend: { outcome: 'definitive-4xx' },
  });
  assert.deepEqual(decision, { action: 'wait' });
});

test('refunds: a 409 in-flight re-send ⇒ wait (the original is still processing)', () => {
  const decision = decideRefundSweep({
    ...RBASE,
    stateRead: { ok: true, matched: null },
    resend: { outcome: 'in-flight-409' },
  });
  assert.deepEqual(decision, { action: 'wait' });
});

// ── initiate reuse-if-fresh (§1.1[2]: never hand out an rzp order the cron
//    may abandon mid-checkout) ────────────────────────────────────────────────

const HOUR_MS = 3_600_000;

test('initiate: no INITIATED row ⇒ mint-new', () => {
  assert.equal(
    decideInitiateReuse({ existingCreatedAtMs: null, nowMs: 0, abandonTtlHours: 24 }),
    'mint-new',
  );
});

test('initiate: a fresh row (inside TTL − 2h margin) ⇒ reuse its rzp order', () => {
  assert.equal(
    decideInitiateReuse({
      existingCreatedAtMs: 0,
      nowMs: 21 * HOUR_MS,
      abandonTtlHours: 24,
    }),
    'reuse',
  );
});

test('initiate: a stale row (at/inside the safety margin) ⇒ supersede-then-mint', () => {
  // Exactly at TTL − margin (22h of a 24h TTL) — boundary belongs to supersede.
  assert.equal(
    decideInitiateReuse({
      existingCreatedAtMs: 0,
      nowMs: 22 * HOUR_MS,
      abandonTtlHours: 24,
    }),
    'supersede-then-mint',
  );
  assert.equal(
    decideInitiateReuse({
      existingCreatedAtMs: 0,
      nowMs: 30 * HOUR_MS,
      abandonTtlHours: 24,
    }),
    'supersede-then-mint',
  );
});

test('refunds: a MATCHED fresh read settles even on a YOUNG refund (age gates only the conclude leg)', () => {
  const decision = decideRefundSweep({
    refundAgeMin: 1,
    concludeMinAgeMin: 15,
    stateRead: { ok: true, matched: { id: 'rfnd_1', status: 'processed' } },
    resend: { outcome: 'not-attempted' },
  });
  assert.deepEqual(decision, {
    action: 'settle-from-state',
    status: 'processed',
    providerRefundId: 'rfnd_1',
  });
});

test('refunds: FULL positive evidence on a YOUNG refund still cannot conclude (age gate)', () => {
  const decision = decideRefundSweep({
    refundAgeMin: 1,
    concludeMinAgeMin: 15,
    stateRead: { ok: true, matched: null },
    resend: { outcome: 'definitive-4xx' },
  });
  assert.deepEqual(decision, { action: 'wait' });
});
