'use client';

import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdjustStock } from '@/hooks/use-product-mutations';

export interface StockAdjustTarget {
  id: string;
  name: string;
  stockQty: number;
}

/**
 * Quick stock adjust. The admin sets a target quantity; we send the signed
 * delta (target − current) to the inventory ledger endpoint (PATCH /products
 * cannot change stock). Submit is disabled when the delta is zero.
 */
export function StockAdjustDialog({
  target,
  onOpenChange,
}: {
  target: StockAdjustTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const adjust = useAdjustStock();
  const [qty, setQty] = useState(0);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (target) {
      setQty(target.stockQty);
      setNote('');
    }
  }, [target]);

  const current = target?.stockQty ?? 0;
  const delta = qty - current;

  function submit() {
    if (!target || delta === 0) return;
    adjust.mutate(
      { productId: target.id, delta, note: note.trim() || undefined },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription className="truncate">{target?.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current stock</span>
            <span className="font-medium tabular-nums">{current}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stock-qty">New quantity</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQty((q) => Math.max(0, q - 1))}
                aria-label="Decrease"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="stock-qty"
                type="number"
                min={0}
                inputMode="numeric"
                value={qty}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  setQty(Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0);
                }}
                className="text-center tabular-nums"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQty((q) => q + 1)}
                aria-label="Increase"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {delta !== 0 ? (
              <p className="text-xs text-muted-foreground">
                {delta > 0 ? `Adding ${delta}` : `Removing ${Math.abs(delta)}`} · recorded in the
                inventory ledger
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Set a different quantity to save.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stock-note">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="stock-note"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Stocktake correction"
            />
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={adjust.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={delta === 0 || adjust.isPending}>
            {adjust.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
