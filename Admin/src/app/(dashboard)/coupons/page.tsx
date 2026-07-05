'use client';

import { useState } from 'react';
import { TicketPercent } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminUser } from '@/hooks/use-admin-auth';
import { useCoupons } from '@/hooks/use-coupons';
import type { CouponDetail } from '@/types/coupon';
import { CouponStatusBadge, discountLabel } from './_components/coupon-format';
import { CouponDialog } from './_components/coupon-dialog';
import { CouponDetailDialog } from './_components/coupon-detail-dialog';

export default function CouponsPage() {
  const admin = useAdminUser();
  const role = admin.data?.role;
  const canView = role === 'ADMIN' || role === 'MANAGER';
  const canManage = role === 'ADMIN';

  const { data, isLoading } = useCoupons();
  const [formOpen, setFormOpen] = useState(false);
  const [formEditing, setFormEditing] = useState<CouponDetail | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  function openNew() {
    setFormEditing(null);
    setFormOpen(true);
  }
  function openEdit(c: CouponDetail) {
    setDetailId(null);
    setFormEditing(c);
    setFormOpen(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <PageHeader title="Coupons & discounts" description="Percentage & fixed-amount codes with usage limits." />
        {canView && canManage && <Button onClick={openNew}>New coupon</Button>}
      </div>

      {!canView ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Coupons are available to administrators and managers only.
        </div>
      ) : isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={TicketPercent}
          title="No coupons yet"
          description="Create a percentage or fixed-amount discount code with optional usage limits and a schedule."
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Code</th>
                <th className="p-3 font-medium">Discount</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Usage</th>
                <th className="p-3 font-medium">Applies to</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setDetailId(c.id)}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                >
                  <td className="p-3 font-mono font-medium">{c.code}</td>
                  <td className="p-3">{discountLabel(c)}</td>
                  <td className="p-3"><CouponStatusBadge status={c.status} /></td>
                  <td className="p-3 text-muted-foreground">
                    {c.usedCount}{c.maxUses != null ? ` / ${c.maxUses}` : ''}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {c.categories.length === 0 ? 'Whole cart' : `${c.categories.length} categor${c.categories.length === 1 ? 'y' : 'ies'}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CouponDialog open={formOpen} onOpenChange={setFormOpen} editing={formEditing} />
      <CouponDetailDialog
        id={detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        onEdit={openEdit}
        canManage={canManage}
      />
    </div>
  );
}
