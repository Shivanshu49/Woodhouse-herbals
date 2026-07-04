'use client';

import { flexRender, getCoreRowModel, useReactTable, type Column } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import type { AdminOrderRow } from '@/types/order';
import { orderColumns, type ColumnMetaLayout } from './columns';

function metaClass(col: Column<AdminOrderRow, unknown>): string | undefined {
  return (col.columnDef.meta as ColumnMetaLayout | undefined)?.className;
}

export function OrdersTable({ data, loading }: { data: AdminOrderRow[]; loading: boolean }) {
  const router = useRouter();
  const table = useReactTable({
    data,
    columns: orderColumns,
    getRowId: (row) => row.id,
    // Server owns pagination/sorting/filtering; the table is a pure renderer.
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id} className={cn(metaClass(h.column))}>
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: 8 }).map((_, r) => (
                <TableRow key={`sk-${r}`} className="hover:bg-transparent">
                  {orderColumns.map((col, c) => (
                    <TableCell
                      key={c}
                      className={cn((col.meta as ColumnMetaLayout | undefined)?.className)}
                    >
                      <Skeleton className="h-4 w-full max-w-[7rem]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/orders/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cn(metaClass(cell.column))}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  );
}
