'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatInr } from '@/lib/money';
import { useCoupon, useSetCouponActive } from '@/hooks/use-coupons';
import type { CouponDetail } from '@/types/coupon';
import { CouponStatusBadge, discountLabel } from './coupon-format';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

export function CouponDetailDialog({
  id,
  onOpenChange,
  onEdit,
  canManage,
}: {
  id: string | null;
  onOpenChange: (o: boolean) => void;
  onEdit: (c: CouponDetail) => void;
  canManage: boolean;
}) {
  const { data, isLoading } = useCoupon(id);
  const setActive = useSetCouponActive();

  return (
    <Dialog open={!!id} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {isLoading || !data ? (
          <Skeleton className="h-72 w-full" />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="font-mono">{data.code}</span>
                <CouponStatusBadge status={data.status} />
              </DialogTitle>
              <DialogDescription>{data.description || discountLabel(data)}</DialogDescription>
            </DialogHeader>

            <div className="divide-y rounded-md border px-3">
              <Row label="Discount">{discountLabel(data)}</Row>
              <Row label="Minimum cart">{data.minCartMinor > 0 ? formatInr(data.minCartMinor) : 'None'}</Row>
              <Row label="Usage">{data.usedCount}{data.maxUses != null ? ` / ${data.maxUses}` : ' (unlimited)'}</Row>
              <Row label="Per-customer limit">{data.perUserLimit ?? 'None'}</Row>
              <Row label="Starts">{fmtDate(data.startsAt)}</Row>
              <Row label="Expires">{fmtDate(data.expiresAt)}</Row>
              <Row label="Applies to">
                {data.categories.length === 0 ? 'Whole cart' : data.categories.map((c) => c.name).join(', ')}
              </Row>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium">Redemptions ({data.redemptionCount})</h4>
              {data.redemptions.length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Not redeemed yet.
                </p>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="p-2 font-medium">Order</th>
                        <th className="p-2 font-medium">Customer</th>
                        <th className="p-2 text-right font-medium">Discount</th>
                        <th className="p-2 text-right font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.redemptions.map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="p-2">{r.orderNumber ?? '—'}</td>
                          <td className="p-2">{r.customerName ?? r.customerEmail ?? 'Guest'}</td>
                          <td className="p-2 text-right">{formatInr(r.discountMinor)}</td>
                          <td className="p-2 text-right text-muted-foreground">{fmtDate(r.redeemedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.redemptionCount > data.redemptions.length && (
                    <p className="border-t p-2 text-xs text-muted-foreground">
                      Showing the {data.redemptions.length} most recent of {data.redemptionCount}.
                    </p>
                  )}
                </div>
              )}
            </div>

            {canManage && (
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={setActive.isPending}
                  onClick={() => setActive.mutate({ id: data.id, active: !data.active })}
                >
                  {data.active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button onClick={() => onEdit(data)}>Edit</Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
