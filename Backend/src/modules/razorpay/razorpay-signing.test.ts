/**
 * Contract tests for Razorpay signature verification (plan §6, Appendix B-2/B-3).
 *
 * Ports the five properties pinned for PhonePe verification 1:1
 * (phonepe.service.test.ts:55-90): byte-exact raw body, tamper reject,
 * re-serialised-JSON reject, empty-signature reject, and length-mismatch
 * returning false instead of timingSafeEqual throwing — plus the webhook
 * secret-rotation fallback (Appendix B-3: retried deliveries created before
 * a rotation stay signed with the OLD secret).
 *
 * Run: npx tsx --test src/modules/razorpay/razorpay-signing.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyWebhookSignature, verifyCheckoutSignature } from './razorpay-signing';

const SECRET = 'whsec_test_secret';
const OLD_SECRET = 'whsec_previous_secret';
const KEY_SECRET = 'rzp_key_secret_test';

const hmac = (message: string, key: string) =>
  createHmac('sha256', key).update(message).digest('hex');

// ── webhook: HMAC-SHA256(rawBody, webhook_secret), hex ──────────────────────

test('webhook: accepts a correctly signed raw body', () => {
  const body = '{"entity":"event","event":"payment.captured","payload":{}}';
  assert.equal(verifyWebhookSignature(body, hmac(body, SECRET), SECRET), true);
});

test('webhook: rejects a tampered body', () => {
  const original = '{"event":"payment.captured"}';
  const tampered = '{"event":"payment.failed"}';
  assert.equal(verifyWebhookSignature(tampered, hmac(original, SECRET), SECRET), false);
});

test('webhook: rejects a re-serialised body (raw bytes are the contract)', () => {
  // Razorpay: "Do not parse or cast the webhook request body."
  const wire = '{"a":1,"b":2}';
  const sig = hmac(wire, SECRET);
  const reserialised = '{"b":2,"a":1}';
  assert.equal(verifyWebhookSignature(reserialised, sig, SECRET), false);
  assert.equal(verifyWebhookSignature(wire, sig, SECRET), true);
});

test('webhook: rejects an empty signature', () => {
  assert.equal(verifyWebhookSignature('{"x":1}', '', SECRET), false);
});

test('webhook: length-mismatched signature returns false instead of throwing', () => {
  assert.equal(verifyWebhookSignature('{"x":1}', 'deadbeef', SECRET), false);
});

test('webhook: accepts a delivery signed with the OLD secret during rotation', () => {
  const body = '{"event":"refund.processed"}';
  const oldSigned = hmac(body, OLD_SECRET);
  assert.equal(verifyWebhookSignature(body, oldSigned, SECRET), false);
  assert.equal(verifyWebhookSignature(body, oldSigned, SECRET, OLD_SECRET), true);
});

test('webhook: a signature matching NEITHER secret is rejected', () => {
  const body = '{"event":"refund.processed"}';
  assert.equal(
    verifyWebhookSignature(body, hmac(body, 'some_third_secret'), SECRET, OLD_SECRET),
    false,
  );
});

// ── checkout: HMAC-SHA256(order_id + '|' + payment_id, key_secret) ──────────

test('checkout: accepts the documented tuple (order_id FIRST, pipe separator)', () => {
  const sig = hmac('order_ABC|pay_XYZ', KEY_SECRET);
  assert.equal(verifyCheckoutSignature('order_ABC', 'pay_XYZ', sig, KEY_SECRET), true);
});

test('checkout: rejects the SWAPPED concatenation order', () => {
  const swapped = hmac('pay_XYZ|order_ABC', KEY_SECRET);
  assert.equal(verifyCheckoutSignature('order_ABC', 'pay_XYZ', swapped, KEY_SECRET), false);
});

test('checkout: rejects a signature for a different payment id', () => {
  const sig = hmac('order_ABC|pay_XYZ', KEY_SECRET);
  assert.equal(verifyCheckoutSignature('order_ABC', 'pay_OTHER', sig, KEY_SECRET), false);
});

test('checkout: empty and length-mismatched signatures return false, never throw', () => {
  assert.equal(verifyCheckoutSignature('order_ABC', 'pay_XYZ', '', KEY_SECRET), false);
  assert.equal(verifyCheckoutSignature('order_ABC', 'pay_XYZ', 'abc123', KEY_SECRET), false);
});
