'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { OrderStatusBadge, PaymentBadge } from '../../_components/badges';
import { RelativeDate } from '../../_components/relative-date';
import { canCancelOrderStatus } from '@/lib/order-badges';
import type { OrderDetail } from '@/types/order';
import { RefundActionButton } from './refund-action-button';
import { InvoiceButton } from './invoice-button';

export function OrderHeader({
  order,
  role,
  onRefund,
  onCancel,
}: {
  order: OrderDetail;
  role: string | undefined;
  onRefund: () => void;
  onCancel: () => void;
}) {
  const paymentStatus = order.payments[0]?.status ?? null;
  const cancellable = canCancelOrderStatus(order.status);

  const cancelButton = (
    <Button variant="outline" size="sm" disabled={!cancellable} onClick={onCancel}>
      Cancel
    </Button>
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <div className="flex items-center gap-3">
        <Link href="/orders" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{order.number}</h1>
            <OrderStatusBadge status={order.status} />
            <PaymentBadge row={{ paymentMethod: order.paymentMethod, paymentStatus }} />
          </div>
          <div className="text-xs text-muted-foreground">
            <RelativeDate iso={order.placedAt} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {cancellable ? (
          cancelButton
        ) : (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block cursor-not-allowed">{cancelButton}</span>
              </TooltipTrigger>
              <TooltipContent>Only pre-shipment orders can be cancelled.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <RefundActionButton order={order} role={role} onRefund={onRefund} size="sm" variant="outline" />
        <Button variant="outline" size="sm" asChild>
          <a href="#notes">Add note</a>
        </Button>
        <InvoiceButton order={order} />
      </div>
    </div>
  );
}
