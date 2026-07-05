'use client';

import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrder } from '@/hooks/use-orders';
import { useAdminUser } from '@/hooks/use-admin-auth';
import { OrderHeader } from './_detail/order-header';
import {
  CustomerCard,
  LineItems,
  PaymentCard,
  ShipmentsCard,
  Timeline,
  TotalsCard,
} from './_detail/sections';
import { NotesSection } from './_detail/notes-section';
import { RefundsPanel } from './_detail/refunds-panel';
import { RefundDialog } from './_detail/refund-dialog';
import { CancelDialog } from './_detail/cancel-dialog';

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const { data: order, isLoading, isError } = useOrder(params.id);
  const admin = useAdminUser();
  const role = admin.data?.role;

  // A single RefundDialog / CancelDialog instance, opened by BOTH the header and
  // the refunds panel — so the gating + dialog live in exactly one place.
  const [refundOpen, setRefundOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-6 lg:grid-cols-[1fr,360px]">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }
  if (isError || !order) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        Order not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OrderHeader
        order={order}
        role={role}
        onRefund={() => setRefundOpen(true)}
        onCancel={() => setCancelOpen(true)}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr,360px]">
        <div className="space-y-6">
          <LineItems items={order.items} />
          <TotalsCard order={order} />
          <Timeline events={order.events} />
          <NotesSection order={order} />
        </div>
        <aside className="space-y-6">
          <CustomerCard order={order} />
          <PaymentCard order={order} />
          <ShipmentsCard shipments={order.shipments} />
          <RefundsPanel order={order} role={role} onRefund={() => setRefundOpen(true)} />
        </aside>
      </div>

      <RefundDialog order={order} open={refundOpen} onOpenChange={setRefundOpen} />
      <CancelDialog order={order} open={cancelOpen} onOpenChange={setCancelOpen} />
    </div>
  );
}
