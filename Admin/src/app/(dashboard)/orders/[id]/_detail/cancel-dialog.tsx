'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCancelOrder } from '@/hooks/use-order-mutations';
import type { OrderDetail } from '@/types/order';

export function CancelDialog({
  order,
  open,
  onOpenChange,
}: {
  order: OrderDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const cancel = useCancelOrder(order.id);
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  function submit() {
    if (!reason.trim()) return;
    cancel.mutate({ reason: reason.trim() }, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel order</DialogTitle>
          <DialogDescription>
            Order {order.number} — items will be restocked. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Reason for cancellation"
          className="w-full resize-none rounded-md border bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={cancel.isPending}>
            Keep order
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={!reason.trim() || cancel.isPending}
          >
            {cancel.isPending ? 'Cancelling…' : 'Cancel order'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
