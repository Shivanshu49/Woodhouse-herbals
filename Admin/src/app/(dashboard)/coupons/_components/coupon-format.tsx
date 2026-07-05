import { formatInr } from '@/lib/money';
import type { CouponStatus, CouponSummary } from '@/types/coupon';

/** Human discount summary: "15% off (up to ₹200)" / "₹100 off". */
export function discountLabel(c: Pick<CouponSummary, 'kind' | 'value' | 'maxDiscountMinor'>): string {
  if (c.kind === 'PERCENT') {
    return `${c.value}% off${c.maxDiscountMinor ? ` (up to ${formatInr(c.maxDiscountMinor)})` : ''}`;
  }
  return `${formatInr(c.value)} off`;
}

const STATUS_META: Record<CouponStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
  scheduled: { label: 'Scheduled', className: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400' },
  expired: { label: 'Expired', className: 'bg-muted text-muted-foreground' },
  exhausted: { label: 'Exhausted', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
  inactive: { label: 'Inactive', className: 'bg-muted text-muted-foreground' },
};

export function CouponStatusBadge({ status }: { status: CouponStatus }) {
  const m = STATUS_META[status];
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${m.className}`}>{m.label}</span>;
}
