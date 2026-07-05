/**
 * Derive a coupon's display status from its own fields — pure so the admin list
 * can badge each coupon without re-deriving the rules inline. The thresholds
 * match CouponsService.preview (expiry/start are strict comparisons), so a
 * coupon shown "active" here is one preview would also accept right now.
 */
export type CouponStatus = 'inactive' | 'expired' | 'scheduled' | 'exhausted' | 'active';

export function couponStatus(
  c: {
    active: boolean;
    startsAt: Date | null;
    expiresAt: Date | null;
    maxUses: number | null;
    usedCount: number;
  },
  now: Date,
): CouponStatus {
  if (!c.active) return 'inactive';
  if (c.expiresAt && c.expiresAt.getTime() < now.getTime()) return 'expired';
  if (c.startsAt && c.startsAt.getTime() > now.getTime()) return 'scheduled';
  if (c.maxUses !== null && c.usedCount >= c.maxUses) return 'exhausted';
  return 'active';
}
