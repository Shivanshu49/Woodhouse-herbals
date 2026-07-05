export type CouponKind = 'PERCENT' | 'FLAT';
export type CouponStatus = 'inactive' | 'expired' | 'scheduled' | 'exhausted' | 'active';

export interface CouponSummary {
  id: string;
  code: string;
  description: string | null;
  kind: CouponKind;
  value: number; // PERCENT: 1..100; FLAT: paise
  maxDiscountMinor: number | null; // PERCENT cap, paise
  minCartMinor: number;
  maxUses: number | null;
  usedCount: number;
  perUserLimit: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
  redemptionCount: number;
  status: CouponStatus;
  categories: Array<{ id: string; name: string }>;
}

export interface CouponRedemptionRow {
  id: string;
  discountMinor: number;
  redeemedAt: string;
  orderNumber: string | null;
  customerName: string | null;
  customerEmail: string | null;
}

export interface CouponDetail extends CouponSummary {
  redemptions: CouponRedemptionRow[];
}

// Scoped to what checkout enforces (see the backend CreateCouponDto). No
// eligibility / concern / product / user / BXGY fields — the API rejects them.
export interface CreateCouponBody {
  code: string;
  description?: string;
  kind: CouponKind;
  value: number;
  maxDiscountMinor?: number;
  minCartMinor?: number;
  maxUses?: number;
  perUserLimit?: number;
  startsAt?: string;
  expiresAt?: string;
  active?: boolean;
  categoryIds?: string[];
}

// Edit sends explicit `null` to CLEAR an optional field (the backend treats an
// omitted key as "leave unchanged", so clearing must be an explicit null).
export interface UpdateCouponBody {
  description?: string;
  kind?: CouponKind;
  value?: number;
  maxDiscountMinor?: number | null;
  minCartMinor?: number;
  maxUses?: number | null;
  perUserLimit?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  active?: boolean;
  categoryIds?: string[];
}
