'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCancelOrder } from '@/hooks/use-order-mutations';
import type { AdminOrderRow } from '@/types/order';

export function CancelOrderDialog({
  order,
  open,
  onOpenChange,
}: {
  order: AdminOrderRow;
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
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancel order {order.number}?
          </DialogTitle>
          <DialogDescription>
            This cancels the order and <strong>restocks all items</strong> to sellable inventory.
            It can&apos;t be undone. If the order was paid, issue a refund separately.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required) — e.g. customer request"
          autoFocus
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
