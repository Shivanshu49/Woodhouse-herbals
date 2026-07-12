/**
 * Razorpay entity-state → internal-action mapping. Pure.
 *
 * Rule zero (plan Global Constraints; Appendix B-3): decisions key on the
 * payload ENTITY STATUS, never on webhook event names or arrival order —
 * "the webhook sequence is not fixed", payment.authorized can arrive already
 * carrying status 'captured', and failed→captured on the SAME payment is
 * documented expected behavior.
 */

/** The fields of a Razorpay payment entity this module reads. */
export interface RazorpayPaymentEntity {
  id: string;
  status: string;
  /** paise — Razorpay uses smallest-subunit integers, same as us. */
  amount: number;
  order_id: string;
}

export interface ExpectedPayment {
  amountMinor: number;
  rzpOrderId: string;
}

export type PaymentEntityAction =
  | { action: 'settle-success'; providerPaymentId: string }
  | { action: 'amount-mismatch-hold'; providerPaymentId: string }
  | { action: 'ignore-mismatched-order'; providerPaymentId: string }
  | { action: 'annotate-failed'; providerPaymentId: string }
  | { action: 'ignore-authorized'; providerPaymentId: string }
  | { action: 'ignore-unknown'; providerPaymentId: string };

/**
 * Decide what a payment entity means for OUR Payment row.
 *
 * - settle-success requires the FULL guard: captured AND amount matches AND
 *   the entity belongs to our rzp order. The same guard runs on the webhook,
 *   verify, and cron paths — one rule, three callers (plan §1.3/§1.4).
 * - A captured entity with the wrong amount is an ANOMALY HOLD, never an
 *   auto-fail: money may have moved (plan §1.3 — deliberate change from
 *   PhonePe, which cancelled + restocked on mismatch).
 * - 'failed' only annotates; order cancellation is cron-owned abandonment.
 */
export function decidePaymentEntityAction(
  entity: RazorpayPaymentEntity,
  expected: ExpectedPayment,
): PaymentEntityAction {
  const providerPaymentId = entity.id;
  if (entity.order_id !== expected.rzpOrderId) {
    return { action: 'ignore-mismatched-order', providerPaymentId };
  }
  switch (entity.status) {
    case 'captured':
      return entity.amount === expected.amountMinor
        ? { action: 'settle-success', providerPaymentId }
        : { action: 'amount-mismatch-hold', providerPaymentId };
    case 'failed':
      return { action: 'annotate-failed', providerPaymentId };
    case 'authorized':
      return { action: 'ignore-authorized', providerPaymentId };
    default:
      return { action: 'ignore-unknown', providerPaymentId };
  }
}

/** The provider-call outcome beyond the entity status — undefined for webhooks. */
export interface RazorpayOutcome {
  /** HTTP status of the S2S call (2xx accepted, 4xx definitive rejection, 5xx transient). */
  httpStatus?: number;
  /** Razorpay error.code when the body carried an error envelope. */
  errorCode?: string;
}

/**
 * Razorpay refund `status` (+ optional S2S outcome) → our RefundStatus token.
 *
 * Ports the mapRefundState POLICY verbatim (refund-transitions.ts:57-69) onto
 * Razorpay's vocabulary:
 *  - an explicit terminal status is the strongest evidence and wins even over
 *    a contradictory transport outcome;
 *  - a definitive rejection (4xx / BAD_REQUEST_ERROR) FAILS the refund so the
 *    payment is released for retry;
 *  - 5xx/transient and every unknown status (webhook docs mention a
 *    'Reversed' outcome absent from the entity enum) park PENDING —
 *    we NEVER guess that money moved.
 */
export function mapRazorpayRefundState(
  status: string,
  outcome?: RazorpayOutcome,
): 'PROCESSED' | 'FAILED' | 'PENDING' {
  if (status === 'processed') return 'PROCESSED';
  if (status === 'failed') return 'FAILED';
  const http = outcome?.httpStatus;
  if (typeof http === 'number' && http >= 500) return 'PENDING'; // transient — recheck later
  const clientRejected =
    (typeof http === 'number' && http >= 400 && http < 500) ||
    outcome?.errorCode === 'BAD_REQUEST_ERROR';
  if (clientRejected) return 'FAILED'; // definitive rejection — release the payment
  return 'PENDING';
}
