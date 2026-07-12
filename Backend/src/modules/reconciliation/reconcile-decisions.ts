/**
 * Pure decision functions for the reconciliation cron (plan §1.3/§1.4/§3)
 * and the initiate reuse-if-fresh rule (§1.1[2]). The cron (Phase 6) and
 * initiate (Phase 3) are thin wrappers: fetch → decide (here) → act via the
 * existing idempotent settle paths. All time inputs are explicit — no
 * Date.now in here.
 */

// ── payments sweep ───────────────────────────────────────────────────────────

export interface PaymentAttempt {
  id: string;
  status: string;
  /** paise */
  amount: number;
  order_id: string;
}

export interface PaymentSweepInput {
  /** Age of the INITIATED Payment row, minutes (from row creation — initiate
   *  supersedes stale rows, so creation age ≈ last initiate activity). */
  paymentAgeMin: number;
  /** RECONCILE_PAYMENT_MIN_AGE_MIN — webhooks get first shot. */
  minAgeMin: number;
  /** PAYMENT_ABANDON_TTL_HOURS. */
  abandonTtlHours: number;
  /** Prior amount-mismatch observations for this row. */
  anomalyObservations: number;
  /** RECONCILE_ANOMALY_MAX_OBSERVATIONS — the hold's terminal. */
  maxAnomalyObservations: number;
  expectedAmountMinor: number;
  /** Our Payment.providerTxnId (the rzp order id). */
  expectedRzpOrderId: string;
  /** Every attempt returned by GET /v1/orders/:id/payments. */
  attempts: readonly PaymentAttempt[];
}

export type PaymentSweepDecision =
  | { action: 'wait' }
  | { action: 'settle-success'; providerPaymentId: string }
  | { action: 'anomaly-hold'; reason: 'amount_mismatch'; providerPaymentId: string }
  | { action: 'anomaly-terminal'; reason: 'amount_mismatch' }
  | { action: 'authorized-stuck'; providerPaymentId: string }
  | { action: 'abandon' };

/**
 * Decide the sweep action for one INITIATED payment row.
 *
 * Ordering of the rules is load-bearing:
 *  1. below min-age → wait (never race fresh webhooks);
 *  2. a captured attempt passing the FULL settle guard (identical to the
 *     webhook/verify guard) → settle;
 *  3. a captured attempt failing the amount guard → anomaly hold with a
 *     terminal after N observations — and it BLOCKS abandonment (money may
 *     have moved; cancel+restock would be wrong);
 *  4. a stuck 'authorized' attempt → no money action, blocks abandonment
 *     (it may still capture; it also blocks new attempts provider-side);
 *  5. past the TTL with none of the above → abandon (cancel + restock —
 *     PhonePe's markFailed semantics live HERE now);
 *  6. otherwise wait.
 */
export function decidePaymentSweep(input: PaymentSweepInput): PaymentSweepDecision {
  if (input.paymentAgeMin < input.minAgeMin) return { action: 'wait' };

  const forThisOrder = input.attempts.filter((a) => a.order_id === input.expectedRzpOrderId);

  const captured = forThisOrder.find((a) => a.status === 'captured');
  if (captured) {
    if (captured.amount === input.expectedAmountMinor) {
      return { action: 'settle-success', providerPaymentId: captured.id };
    }
    if (input.anomalyObservations >= input.maxAnomalyObservations) {
      return { action: 'anomaly-terminal', reason: 'amount_mismatch' };
    }
    return {
      action: 'anomaly-hold',
      reason: 'amount_mismatch',
      providerPaymentId: captured.id,
    };
  }

  const authorized = forThisOrder.find((a) => a.status === 'authorized');
  if (authorized) {
    return { action: 'authorized-stuck', providerPaymentId: authorized.id };
  }

  if (input.paymentAgeMin > input.abandonTtlHours * 60) return { action: 'abandon' };
  return { action: 'wait' };
}

// ── refunds sweep (§3 recovery routine) ──────────────────────────────────────

export interface RefundSweepInput {
  /** Age of the PENDING Refund row, minutes. */
  refundAgeMin: number;
  /** REFUND_CONCLUDE_MIN_AGE_MIN. */
  concludeMinAgeMin: number;
  /** PRIMARY probe: fresh provider state read (GET /v1/refunds/:id, or the
   *  per-payment list matched client-side by receipt). ok:false = the read
   *  itself failed (network/5xx) — NO conclusion may be drawn from it. */
  stateRead: { ok: true; matched: { id: string; status: string } | null } | { ok: false };
  /** SECONDARY probe: the idempotent re-send, ONLY for creation ambiguity.
   *  'replayed' returns the saved original response (a stale snapshot —
   *  never a state poll, but proof the create landed). */
  resend:
    | { outcome: 'replayed'; refund: { id: string; status: string } }
    | { outcome: 'in-flight-409' }
    | { outcome: 'definitive-4xx' }
    | { outcome: 'transient' }
    | { outcome: 'not-attempted' };
}

export type RefundSweepDecision =
  | { action: 'wait' }
  | { action: 'settle-from-state'; status: string; providerRefundId: string }
  | { action: 'conclude-failed' };

/**
 * §3 conclude rule, verbatim: conclude FAILED **only on positive evidence of
 * absence** — a SUCCESSFUL state read demonstrably containing no matching
 * refund AND a DEFINITIVE (4xx) non-created outcome from the re-send.
 * Timeouts and failed reads always wait: two timeouts must never release the
 * payment CAS (the adversarial-review double-refund hole).
 */
export function decideRefundSweep(input: RefundSweepInput): RefundSweepDecision {
  if (input.refundAgeMin < input.concludeMinAgeMin) return { action: 'wait' };

  if (input.stateRead.ok && input.stateRead.matched) {
    return {
      action: 'settle-from-state',
      status: input.stateRead.matched.status,
      providerRefundId: input.stateRead.matched.id,
    };
  }

  if (input.resend.outcome === 'replayed') {
    return {
      action: 'settle-from-state',
      status: input.resend.refund.status,
      providerRefundId: input.resend.refund.id,
    };
  }

  if (input.stateRead.ok && input.stateRead.matched === null) {
    if (input.resend.outcome === 'definitive-4xx') return { action: 'conclude-failed' };
  }

  return { action: 'wait' };
}

// ── initiate reuse-if-fresh (§1.1[2]) ────────────────────────────────────────

const REUSE_SAFETY_MARGIN_HOURS = 2;

/**
 * Never hand out an rzp order id the cron may abandon while the customer is
 * mid-checkout: reuse only while the row is younger than TTL − margin;
 * otherwise CAS the stale row FAILED (superseded) and mint fresh — which
 * also resets the abandonment clock.
 */
export function decideInitiateReuse(input: {
  existingCreatedAtMs: number | null;
  nowMs: number;
  abandonTtlHours: number;
}): 'mint-new' | 'reuse' | 'supersede-then-mint' {
  if (input.existingCreatedAtMs === null) return 'mint-new';
  const ageMs = input.nowMs - input.existingCreatedAtMs;
  const cutoffMs = (input.abandonTtlHours - REUSE_SAFETY_MARGIN_HOURS) * 3_600_000;
  return ageMs < cutoffMs ? 'reuse' : 'supersede-then-mint';
}
