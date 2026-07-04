'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { formatInr } from '@/lib/money';
import type { AdminOrderRow } from '@/types/order';
import { OrderStatusBadge, PaymentBadge, GuestBadge } from './badges';
import { RelativeDate } from './relative-date';
import { RowActions } from './row-actions';

export interface ColumnMetaLayout {
  className?: string;
}

export const orderColumns: ColumnDef<AdminOrderRow>[] = [
  {
    accessorKey: 'number',
    header: 'Order',
    cell: ({ row }) => <span className="font-medium">{row.original.number}</span>,
    meta: { className: 'font-mono' } as ColumnMetaLayout,
  },
  {
    accessorKey: 'placedAt',
    header: 'Placed',
    cell: ({ row }) => <RelativeDate iso={row.original.placedAt} />,
  },
  {
    accessorKey: 'customerName',
    header: 'Customer',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="truncate">{row.original.customerName}</span>
        {row.original.isGuest ? <GuestBadge /> : null}
      </div>
    ),
  },
  {
    accessorKey: 'itemCount',
    header: 'Items',
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">{row.original.itemCount}</span>
    ),
    meta: { className: 'w-16 text-right' } as ColumnMetaLayout,
  },
  {
    accessorKey: 'totalMinor',
    header: 'Total',
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">{formatInr(row.original.totalMinor)}</span>
    ),
    meta: { className: 'text-right' } as ColumnMetaLayout,
  },
  {
    id: 'payment',
    header: 'Payment',
    cell: ({ row }) => <PaymentBadge row={row.original} />,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
  },
  {
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions row={row.original} />,
    meta: { className: 'w-12 text-right' } as ColumnMetaLayout,
  },
];
