/**
 * Tests for receipt / idempotency-key derivation (plan §3; Appendix B-1/B-4).
 *
 * Order receipt: ≤40 chars (documented cap), documented-unique ⇒ minted per
 * Payment row (order number + row suffix), deterministic.
 * Refund idempotency key: the existing deriveMerchantRefundId output must
 * satisfy Razorpay's X-Refund-Idempotency rule (≥10 chars; alphanumerics,
 * hyphens, underscores only) — validated here so Phase 5 can reuse it as
 * both header AND refund receipt.
 *
 * Run: npx tsx --test src/modules/razorpay/razorpay-receipt.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveOrderReceipt, isValidRefundIdempotencyKey } from './razorpay-receipt';
import { deriveMerchantRefundId } from '../refunds/refund-transitions';

test('order receipt is deterministic for the same order + payment row', () => {
  const a = deriveOrderReceipt('WH-ABC123', 'clx0987654321');
  const b = deriveOrderReceipt('WH-ABC123', 'clx0987654321');
  assert.equal(a, b);
});

test('order receipt stays within the documented 40-char cap at MAX order-number length', () => {
  // InitiatePaymentDto allows ^WH-[A-Z0-9]{6,32}$ ⇒ up to 35 chars.
  const maxOrderNumber = `WH-${'X'.repeat(32)}`;
  const receipt = deriveOrderReceipt(maxOrderNumber, 'clx0987654321');
  assert.ok(receipt.length <= 40, `receipt ${receipt} is ${receipt.length} chars`);
});

test('order receipt differs per payment row (documented-unique receipt per mint)', () => {
  const a = deriveOrderReceipt('WH-ABC123', 'clxrow00000001');
  const b = deriveOrderReceipt('WH-ABC123', 'clxrow00000002');
  assert.notEqual(a, b);
});

test('order receipt keeps the order number visible for human reconciliation', () => {
  assert.match(deriveOrderReceipt('WH-ABC123', 'clx0987654321'), /^WH-ABC123-/);
});

test('order receipt charset is alphanumeric + hyphen (ASCII-safe)', () => {
  const receipt = deriveOrderReceipt('WH-ABC123', 'clx_09876/54321');
  assert.match(receipt, /^[A-Za-z0-9-]+$/);
});

test('deriveMerchantRefundId output is a valid X-Refund-Idempotency key', () => {
  // Real cuid-shaped refund ids (25 chars) — the derived 'RF…' value (alnum,
  // ≤38) must satisfy: ≥10 chars; alphanumerics, hyphens, underscores only.
  for (const id of ['clx0987654321abcdefghijkl', 'cm3z9y8x7w6v5u4t3s2r1q0p9']) {
    const key = deriveMerchantRefundId(id);
    assert.ok(
      isValidRefundIdempotencyKey(key),
      `derived key ${JSON.stringify(key)} must satisfy the header rule`,
    );
  }
  // A pathologically short id would derive an INVALID key — the validator is
  // the guard Phase 5's client must consult before sending the header.
  assert.equal(isValidRefundIdempotencyKey(deriveMerchantRefundId('ab12')), false);
});

test('isValidRefundIdempotencyKey rejects short keys and bad charsets', () => {
  assert.equal(isValidRefundIdempotencyKey('RFshort'), false); // 7 chars
  assert.equal(isValidRefundIdempotencyKey('has spaces in it'), false);
  assert.equal(isValidRefundIdempotencyKey('has.dots.in.it'), false);
  assert.equal(isValidRefundIdempotencyKey('under_scores-and-hyphens-ok'), true);
});
