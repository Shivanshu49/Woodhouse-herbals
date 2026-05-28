/**
 * Pure pricing logic — kept separate from the service so it can be unit-
 * tested with no Prisma dependency.
 */

import { CouponKind } from '@prisma/client';

export interface CouponPolicy {
  kind: CouponKind;
  value: number;             // % for PERCENT, paise for FLAT
  maxDiscountMinor: number | null;
  minCartMinor: number;
}

export interface PricingInput {
  subtotalMinor: number;
  /**
   * The subtotal of lines the coupon is actually applicable to. For a
   * whole-cart coupon, equals `subtotalMinor`. For a category-restricted
   * coupon, equals the sum of the qualifying lines.
   */
  applicableSubtotalMinor: number;
}

export interface PricingResult {
  ok: boolean;
  discountMinor: number;
  reason?: string;
}

/**
 * Compute the discount this coupon would grant for the given cart.
 *
 * Invariants:
 * - Never returns a negative discount.
 * - Caps PERCENT discounts at `maxDiscountMinor` if provided.
 * - Caps FLAT discounts at `applicableSubtotalMinor` so a ₹500 flat coupon
 *   on a ₹400 cart yields ₹400, not -₹100.
 * - Rejects when `subtotalMinor < minCartMinor`.
 */
export function computeDiscount(policy: CouponPolicy, input: PricingInput): PricingResult {
  if (input.subtotalMinor < policy.minCartMinor) {
    return {
      ok: false,
      discountMinor: 0,
      reason: `Minimum cart value is ₹${policy.minCartMinor / 100}`,
    };
  }
  if (input.applicableSubtotalMinor <= 0) {
    return { ok: false, discountMinor: 0, reason: 'No applicable items in cart' };
  }

  let raw: number;
  if (policy.kind === CouponKind.PERCENT) {
    if (policy.value <= 0 || policy.value > 100) {
      return { ok: false, discountMinor: 0, reason: 'Invalid coupon configuration' };
    }
    raw = Math.floor((input.applicableSubtotalMinor * policy.value) / 100);
    if (policy.maxDiscountMinor !== null && raw > policy.maxDiscountMinor) {
      raw = policy.maxDiscountMinor;
    }
  } else {
    raw = Math.min(policy.value, input.applicableSubtotalMinor);
  }
  if (raw < 0) raw = 0;
  return { ok: true, discountMinor: raw };
}
