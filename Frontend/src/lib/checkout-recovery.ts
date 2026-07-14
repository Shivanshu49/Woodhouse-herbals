/**
 * Map a `POST /orders` failure to a DISTINCT recovery action.
 *
 * `GET /cart` does NO re-validation (it echoes stored lines), so after an
 * order-create failure we must act on the ERROR itself, not re-fetch the cart
 * (which would show zero delta and loop the user into the same failure forever).
 * Each `createFromCart` throw kind maps to its own affordance:
 *   - out-of-stock / "Only N left"  → reduce that line, re-acknowledge
 *   - "no longer available"          → remove that line, re-acknowledge
 *   - "Cart is empty"                → back to the cart page
 *   - coupon rejected                → strip the coupon, offer resubmit without it
 *   - inventory CAS ("retry")        → transient retry of the SAME submit
 *   - anything else                  → generic error (never silently proceed)
 *
 * A 4xx here must NEVER open checkout.js — the caller gates on that separately.
 */
export type RecoveryKind =
  | 'reduce-quantity'
  | 'remove-line'
  | 'empty-cart'
  | 'strip-coupon'
  | 'retry'
  | 'unknown';

export interface RecoveryAction {
  kind: RecoveryKind;
  message: string;
  /** Whether the user must re-acknowledge the change before re-submitting. */
  requiresReack: boolean;
}

/**
 * @param status  HTTP status of the failed POST /orders
 * @param message server error message (ApiError.message)
 * @param hadCoupon whether the submit carried a couponCode (disambiguates a
 *                  generic 400 that is really a coupon rejection)
 */
export function classifyOrderError(
  status: number,
  message: string,
  hadCoupon: boolean,
): RecoveryAction {
  const m = (message ?? '').trim();

  // Inventory CAS — a genuine concurrent race; retrying the same submit is right.
  if (/stock changed concurrently/i.test(m) || /please retry/i.test(m)) {
    return { kind: 'retry', message: m || 'Please try again.', requiresReack: false };
  }
  // Insufficient stock / out of stock (ConflictException).
  if (/out of stock/i.test(m) || /only\s+\d+\s+of/i.test(m) || /reduce the quantity/i.test(m)) {
    return { kind: 'reduce-quantity', message: m, requiresReack: true };
  }
  // Soft-deleted / vanished product (BadRequest).
  if (/no longer available/i.test(m)) {
    return { kind: 'remove-line', message: m, requiresReack: true };
  }
  if (/cart is empty/i.test(m)) {
    return { kind: 'empty-cart', message: m, requiresReack: false };
  }
  // Coupon rejection: the reason text varies ("expired", "minimum cart…"), so a
  // 400 that isn't one of the above AND carried a coupon is treated as a coupon
  // failure — strip it and let the order go through without it.
  if (/coupon/i.test(m) || (hadCoupon && status === 400)) {
    return {
      kind: 'strip-coupon',
      message: m || 'That coupon could not be applied.',
      requiresReack: true,
    };
  }
  return {
    kind: 'unknown',
    message: m || 'We couldn’t place your order. Please try again.',
    requiresReack: false,
  };
}
