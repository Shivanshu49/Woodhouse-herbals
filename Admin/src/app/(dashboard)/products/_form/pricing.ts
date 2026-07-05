/**
 * Pricing & Tax money helpers. Indian retail rules: the customer-facing amount
 * is entered in rupees but stored as INTEGER paise (never floats), prices are
 * GST-inclusive (so GST is a reverse split of the gross), and margin is figured
 * on the net-of-GST price, not the gross.
 */

export const GST_RATES = [
  { value: 'GST_18', label: '18% — most cosmetics & skincare', percent: 18 },
  { value: 'GST_12', label: '12%', percent: 12 },
  { value: 'GST_5', label: '5%', percent: 5 },
  { value: 'GST_28', label: '28%', percent: 28 },
  { value: 'EXEMPT', label: 'Exempt (0%)', percent: 0 },
] as const;

export type GstRateValue = (typeof GST_RATES)[number]['value'];

/** The GST enum values as a tuple, for z.enum(). */
export const GST_RATE_VALUES = ['EXEMPT', 'GST_5', 'GST_12', 'GST_18', 'GST_28'] as const;

export const GST_PERCENT: Record<GstRateValue, number> = {
  EXEMPT: 0,
  GST_5: 5,
  GST_12: 12,
  GST_18: 18,
  GST_28: 28,
};

// The rupee⇄paise money helpers live in lib/money (shared with coupons); kept
// re-exported here so existing pricing importers + tests are unaffected.
import { rupeesToPaise, paiseToRupees } from '@/lib/money';
export { rupeesToPaise, paiseToRupees };

export interface GstBreakdown {
  netMinor: number;
  gstMinor: number;
  ratePercent: number;
}

/** Reverse-split a GST-INCLUSIVE gross amount into net + GST (integer paise). */
export function gstBreakdown(priceMinor: number, ratePercent: number): GstBreakdown {
  if (ratePercent <= 0 || priceMinor <= 0) {
    return { netMinor: Math.max(0, priceMinor), gstMinor: 0, ratePercent };
  }
  const netMinor = Math.round(priceMinor / (1 + ratePercent / 100));
  return { netMinor, gstMinor: priceMinor - netMinor, ratePercent };
}

export interface Margin {
  profitMinor: number;
  marginPct: number;
}

/**
 * Margin on the NET-of-GST price: profit = net − cost, margin% = profit / net.
 * Returns null when there's no net to divide by.
 */
export function computeMargin(netMinor: number, costMinor: number): Margin | null {
  if (netMinor <= 0) return null;
  const profitMinor = netMinor - costMinor;
  return { profitMinor, marginPct: Math.round((profitMinor / netMinor) * 100) };
}

export interface PricingInput {
  price: string;
  compareAtPrice: string;
  costPrice: string;
  gstRate: GstRateValue;
  hsnCode: string;
  saleStartsAt: string;
  saleEndsAt: string;
}

export interface PricingPayload {
  priceMinor: number;
  compareAtPriceMinor?: number;
  costPriceMinor?: number;
  gstRate: GstRateValue;
  hsnCode?: string;
  saleStartsAt?: string;
  saleEndsAt?: string;
}

/** Map the form's pricing fields to the backend payload shape (paise + ISO dates). */
export function pricingToPayload(v: PricingInput): PricingPayload {
  const out: PricingPayload = {
    priceMinor: rupeesToPaise(v.price) ?? 0,
    gstRate: v.gstRate,
  };
  const compare = v.compareAtPrice.trim() ? rupeesToPaise(v.compareAtPrice) : null;
  if (compare !== null) out.compareAtPriceMinor = compare;
  const cost = v.costPrice.trim() ? rupeesToPaise(v.costPrice) : null;
  if (cost !== null) out.costPriceMinor = cost;
  if (v.hsnCode.trim()) out.hsnCode = v.hsnCode.trim();
  if (v.saleStartsAt) out.saleStartsAt = new Date(v.saleStartsAt).toISOString();
  if (v.saleEndsAt) out.saleEndsAt = new Date(v.saleEndsAt).toISOString();
  return out;
}
