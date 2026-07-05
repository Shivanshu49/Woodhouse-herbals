'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { api } from '@/lib/api';
import { canDownloadInvoice } from '@/lib/order-badges';
import type { OrderDetail } from '@/types/order';

export function InvoiceButton({ order }: { order: OrderDetail }) {
  const [busy, setBusy] = useState(false);
  const allowed = canDownloadInvoice(order.status, order.paymentMethod);

  async function download() {
    setBusy(true);
    try {
      const blob = await api.orders.invoicePdf(order.id);
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = order.invoice ? `${order.invoice.number}.pdf` : `invoice-${order.number}.pdf`;
        a.click();
      } finally {
        // revoke after the click has fired so repeated downloads don't leak blobs
        setTimeout(() => URL.revokeObjectURL(url), 0);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setBusy(false);
    }
  }

  const button = (
    <Button variant="outline" size="sm" disabled={!allowed || busy} onClick={download}>
      {busy ? 'Preparing…' : 'Download invoice'}
    </Button>
  );
  if (allowed) return button;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block cursor-not-allowed">{button}</span>
        </TooltipTrigger>
        <TooltipContent>Not invoiceable yet (pending payment or cancelled).</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
