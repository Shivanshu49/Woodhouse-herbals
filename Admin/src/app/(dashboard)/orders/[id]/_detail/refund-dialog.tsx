'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatInr } from '@/lib/money';
import { useManualRefund, useRefundOrder } from '@/hooks/use-order-mutations';
import type { OrderDetail, RefundDisposition } from '@/types/order';

// Restock is DERIVED from the disposition — one control, restock consequence
// spelled out, contradictory states unrepresentable (never silently defaulted).
const DISPOSITIONS: { value: RefundDisposition; label: string; hint: string }[] = [
  { value: 'RETURNED', label: 'Returned', hint: 'Goods came back — restock' },
  { value: 'DAMAGED', label: 'Damaged', hint: 'Unsellable — no restock' },
  { value: 'LOST', label: 'Lost', hint: 'Gone / lost in transit — no restock' },
];

export function RefundDialog({
  order,
  open,
  onOpenChange,
}: {
  order: OrderDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isCod = order.paymentMethod === 'COD';
  const refund = useRefundOrder(order.id);
  const manual = useManualRefund(order.id);
  const pending = refund.isPending || manual.isPending;

  const [disposition, setDisposition] = useState<RefundDisposition | ''>('');
  const [utr, setUtr] = useState('');
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) {
      setDisposition('');
      setUtr('');
      setReason('');
    }
  }, [open]);

  const utrMissing = isCod && !utr.trim();
  const canSubmit = disposition !== '' && !utrMissing && !pending;

  function submit() {
    if (disposition === '') return;
    const done = { onSuccess: () => onOpenChange(false) };
    if (isCod) {
      manual.mutate({ utrReference: utr.trim(), disposition, reason: reason.trim() || undefined }, done);
    } else {
      refund.mutate({ disposition, reason: reason.trim() || undefined }, done);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isCod ? 'Mark refunded (manual)' : 'Refund via Razorpay'}</DialogTitle>
          <DialogDescription>
            Order {order.number} · {formatInr(order.totalMinor)}
          </DialogDescription>
        </DialogHeader>

        {isCod && (
          <div className="space-y-1">
            <Label htmlFor="utr">UTR reference (required)</Label>
            <Input
              id="utr"
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              placeholder="Bank/UPI UTR of the transfer"
            />
            <p className="text-xs text-muted-foreground">Proof the out-of-band transfer happened.</p>
          </div>
        )}

        <div className="space-y-2">
          <Label>Disposition &amp; restock</Label>
          <RadioGroup value={disposition} onValueChange={(v) => setDisposition(v as RefundDisposition)}>
            {DISPOSITIONS.map((d) => (
              <label
                key={d.value}
                htmlFor={`disp-${d.value}`}
                className="flex cursor-pointer items-start gap-2 rounded-md border p-2"
              >
                <RadioGroupItem id={`disp-${d.value}`} value={d.value} className="mt-0.5" />
                <span className="text-sm">
                  <span className="font-medium">{d.label}</span> — {d.hint}
                </span>
              </label>
            ))}
          </RadioGroup>
        </div>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Reason (optional)"
          className="w-full resize-none rounded-md border bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {pending ? 'Processing…' : isCod ? 'Mark refunded' : 'Initiate refund'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
