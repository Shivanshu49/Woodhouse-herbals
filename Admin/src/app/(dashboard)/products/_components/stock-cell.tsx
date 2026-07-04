'use client';

import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StockBadge } from './badges';
import { StockAdjustDialog } from './stock-adjust-dialog';
import type { AdminProductRow } from '@/types/product';

export function StockCell({ row }: { row: AdminProductRow }) {
  const [open, setOpen] = useState(false);
  const archived = !!row.deletedAt;

  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-right font-medium tabular-nums">{row.stockQty}</span>
      <StockBadge qty={row.stockQty} />
      {!archived ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          aria-label="Adjust stock"
          title="Adjust stock"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      <StockAdjustDialog
        target={open ? { id: row.id, name: row.name, stockQty: row.stockQty } : null}
        onOpenChange={setOpen}
      />
    </div>
  );
}
