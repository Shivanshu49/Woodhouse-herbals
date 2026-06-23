/**
 * Pure order-total composition — combines the (already-validated) coupon
 * discount, the shipping fee, and the GST split into the final money fields
 * persisted on an Order. Kept Prisma-free so it can be unit tested (see
 * order-pricing.test.ts), mirroring the coupon-pricing module.
 *
 * GST model: catalog prices are GST-INCLUSIVE (the standard Indian D2C MRP
 * convention), so enabling tax never changes what the customer pays —
 * `taxMinor` is the GST component *embedded within* `totalMinor`, surfaced
 * for the invoice / GST compliance. The split is the standard back-calc:
 *
 *     taxMinor = round(totalMinor * rate / (100 + rate))
 *
 * All money is integer paise (minor units), consistent with the rest of the
 * codebase.
 */

export interface OrderTotalsInput {
  subtotalMinor: number;
  /** Coupon discount in paise (0 if no coupon). */
  discountMinor: number;
  /** Shipping fee in paise (0 for free shipping). */
  shippingMinor: number;
  /** GST rate as a percentage, e.g. 18. 0 disables the tax split. */
  gstRatePercent: number;
}

export interface OrderTotals {
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export function computeOrderTotals(input: OrderTotalsInput): OrderTotals {
  const subtotalMinor = Math.max(0, Math.trunc(input.subtotalMinor));
  const shippingMinor = Math.max(0, Math.trunc(input.shippingMinor));
  // Never discount more than the goods value — defends against a stale or
  // tampered discount quote producing a negative payable.
  const discountMinor = Math.min(
    Math.max(0, Math.trunc(input.discountMinor)),
    subtotalMinor,
  );

  const totalMinor = subtotalMinor - discountMinor + shippingMinor;

  const rate = input.gstRatePercent;
  const taxMinor =
    rate > 0 ? Math.round((totalMinor * rate) / (100 + rate)) : 0;

  return { subtotalMinor, discountMinor, shippingMinor, taxMinor, totalMinor };
}
