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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAddOrderNote } from '@/hooks/use-order-mutations';
import type { AdminOrderRow } from '@/types/order';

export function AddNoteDialog({
  order,
  open,
  onOpenChange,
}: {
  order: AdminOrderRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const add = useAddOrderNote(order.id);
  const [body, setBody] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setBody('');
      setVisible(false);
    }
  }, [open]);

  function submit() {
    if (!body.trim()) return;
    add.mutate(
      { body: body.trim(), isCustomerVisible: visible },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Add note</DialogTitle>
          <DialogDescription>Order {order.number}</DialogDescription>
        </DialogHeader>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Internal note about this order…"
          className="w-full resize-none rounded-md border bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex items-center gap-2">
          <Switch id="note-visible" checked={visible} onCheckedChange={setVisible} />
          <Label htmlFor="note-visible" className="text-sm">
            Visible to customer
          </Label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={add.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!body.trim() || add.isPending}>
            {add.isPending ? 'Saving…' : 'Add note'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
