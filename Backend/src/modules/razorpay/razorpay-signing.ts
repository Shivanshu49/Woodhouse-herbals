import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Razorpay signature verification — pure functions, byte-exact inputs.
 *
 * Two DIFFERENT schemes (do not conflate — plan Appendix B-2/B-3):
 *  - Webhook:  X-Razorpay-Signature = HMAC-SHA256(rawBody, webhook_secret),
 *    hex. The raw request bytes are the contract ("Do not parse or cast the
 *    webhook request body") — re-serialised JSON must fail.
 *  - Checkout: razorpay_signature = HMAC-SHA256(order_id + '|' + payment_id,
 *    key_secret), hex. order_id FIRST, pipe separator. Proves Razorpay
 *    generated the tuple — NOT that money is captured; callers must still
 *    fetch the payment before settling (plan §1.3).
 *
 * All comparisons are constant-time with a length pre-check (mismatched
 * lengths return false — timingSafeEqual would throw).
 */

function safeEqualHex(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

/**
 * Verify a webhook delivery. `oldSecret` covers the rotation window:
 * Razorpay retries deliveries created BEFORE a secret rotation signed with
 * the OLD secret for up to 24h (Appendix B-3) — pass
 * RAZORPAY_WEBHOOK_SECRET_OLD while it is set, clear it after the window.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
  oldSecret?: string,
): boolean {
  if (!signature) return false;
  const current = createHmac('sha256', secret).update(rawBody).digest('hex');
  if (safeEqualHex(current, signature)) return true;
  if (oldSecret) {
    const previous = createHmac('sha256', oldSecret).update(rawBody).digest('hex');
    return safeEqualHex(previous, signature);
  }
  return false;
}

/** Verify the Standard Checkout success tuple (client fast-path hint). */
export function verifyCheckoutSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
  keySecret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  return safeEqualHex(expected, signature);
}
