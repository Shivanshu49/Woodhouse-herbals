'use client';

import { Star } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/cn';
import { formatInr } from '@/lib/money';
import { CATEGORY_LABELS } from '@/lib/product-meta';
import type { AdminProductRow } from '@/types/product';
import { ProductThumb } from './product-thumb';
import { StatusBadge } from './badges';
import { StockCell } from './stock-cell';
import { RowActions } from './row-actions';

/** Per-column layout hints, applied to both <th> and <td> by ProductsTable. */
export interface ColumnMetaLayout {
  className?: string;
}

export const productColumns: ColumnDef<AdminProductRow>[] = [
  {
    id: 'select',
    meta: { className: 'w-10' } satisfies ColumnMetaLayout,
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
              ? 'indeterminate'
              : false
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        onClick={(e) => e.stopPropagation()}
        aria-label="Select all rows on this page"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Select ${row.original.name}`}
      />
    ),
    enableSorting: false,
  },
  {
    id: 'thumbnail',
    meta: { className: 'w-14' } satisfies ColumnMetaLayout,
    header: () => <span className="sr-only">Image</span>,
    cell: ({ row }) => (
      <ProductThumb url={row.original.thumbnailUrl} alt={row.original.thumbnailAlt || row.original.name} />
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'name',
    header: () => 'Product',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">{row.original.name}</span>
        {row.original.featured ? (
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Featured" />
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: 'sku',
    header: () => 'SKU',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">{row.original.sku}</span>
    ),
  },
  {
    accessorKey: 'category',
    header: () => 'Category',
    cell: ({ row }) => (
      <span className="text-muted-foreground">{CATEGORY_LABELS[row.original.category]}</span>
    ),
  },
  {
    accessorKey: 'priceMinor',
    meta: { className: 'text-right' } satisfies ColumnMetaLayout,
    header: () => 'Price',
    cell: ({ row }) => {
      const { priceMinor, compareAtPriceMinor } = row.original;
      return (
        <div className="text-right tabular-nums">
          <span className="font-medium">{formatInr(priceMinor)}</span>
          {compareAtPriceMinor && compareAtPriceMinor > priceMinor ? (
            <span className="ml-1.5 text-xs text-muted-foreground line-through">
              {formatInr(compareAtPriceMinor)}
            </span>
          ) : null}
        </div>
      );
    },
  },
  {
    accessorKey: 'stockQty',
    header: () => 'Stock',
    cell: ({ row }) => <StockCell row={row.original} />,
  },
  {
    accessorKey: 'status',
    header: () => 'Status',
    cell: ({ row }) => <StatusBadge row={row.original} />,
  },
  {
    id: 'actions',
    meta: { className: 'w-12 text-right' } satisfies ColumnMetaLayout,
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className={cn('flex justify-end')}>
        <RowActions row={row.original} />
      </div>
    ),
    enableSorting: false,
  },
];
