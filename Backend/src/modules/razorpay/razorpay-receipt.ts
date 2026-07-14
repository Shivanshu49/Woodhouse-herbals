/**
 * Receipt / idempotency-key derivation for Razorpay. Pure.
 *
 * Order receipt (plan §3; Appendix B-1): Razorpay's Orders `receipt` is
 * optional, MAX 40 CHARS, and documented as unique — so it is minted per
 * Payment row (order number + row suffix), never reused across mints, and
 * never used as a lookup key on our side (it is a human/reconciliation
 * cross-reference; the lookup key is the rzp order_id in providerTxnId).
 *
 * Refund idempotency key (Appendix B-4): X-Refund-Idempotency requires
 * ≥10 chars, alphanumerics/hyphens/underscores only. We reuse the existing
 * deterministic deriveMerchantRefundId (refund-transitions.ts) as BOTH the
 * header and the refund `receipt`; the validator here is the guard the
 * client consults before sending.
 */

const ORDER_RECEIPT_MAX = 40;
const ROW_SUFFIX_LEN = 8;

/**
 * Deterministic, ≤40-char, per-mint order receipt: the order number (kept as
 * a readable prefix, truncated only if a max-length number forces it) plus
 * the last 8 alphanumeric chars of the Payment row id.
 */
export function deriveOrderReceipt(orderNumber: string, paymentRowId: string): string {
  const suffix = paymentRowId.replace(/[^A-Za-z0-9]/g, '').slice(-ROW_SUFFIX_LEN);
  const budget = ORDER_RECEIPT_MAX - suffix.length - 1; // -1 for the separator
  return `${orderNumber.slice(0, budget)}-${suffix}`;
}

/** Razorpay's documented X-Refund-Idempotency rule (Appendix B-4). */
const REFUND_IDEMPOTENCY_RE = /^[A-Za-z0-9_-]{10,}$/;

export function isValidRefundIdempotencyKey(key: string): boolean {
  return REFUND_IDEMPOTENCY_RE.test(key);
}
