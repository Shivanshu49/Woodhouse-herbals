'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAdjustStock } from '@/hooks/use-inventory';
import { ADJUST_REASONS, type InventoryRow } from '@/types/inventory';

const selectCls = 'h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus:ring-2 focus:ring-ring';

export function AdjustDialog({
  row,
  onOpenChange,
}: {
  row: InventoryRow | null;
  onOpenChange: (o: boolean) => void;
}) {
  const adjust = useAdjustStock();
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState<string>('RESTOCK');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (row) {
      setDelta('');
      setReason('RESTOCK');
      setNote('');
    }
  }, [row]);

  const n = Number(delta);
  const valid = delta.trim() !== '' && Number.isInteger(n) && n !== 0;
  const resulting = row ? row.stockQty + (Number.isFinite(n) ? n : 0) : 0;

  function submit() {
    if (!row || !valid) return;
    adjust.mutate(
      { productId: row.id, delta: n, reason, note: note.trim() || undefined },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {row?.name} · current {row?.stockQty}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Label htmlFor="delta">Change (signed)</Label>
          <Input
            id="delta"
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="+10 to add, -3 to remove"
          />
          {valid && (
            <p className="text-xs text-muted-foreground">
              New quantity: {row?.stockQty} {n >= 0 ? '+' : '−'} {Math.abs(n)} = <b>{resulting}</b>
            </p>
          )}
          {delta.trim() !== '' && n === 0 && <p className="text-xs text-red-600">A zero change is not allowed.</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="reason">Reason</Label>
          <select id="reason" className={selectCls} value={reason} onChange={(e) => setReason(e.target.value)}>
            {ADJUST_REASONS.map((r) => (
              <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="note">Note (optional)</Label>
          <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Stocktake ref, supplier, etc." />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={adjust.isPending}>Cancel</Button>
          <Button onClick={submit} disabled={!valid || adjust.isPending}>
            {adjust.isPending ? 'Saving…' : 'Apply adjustment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
