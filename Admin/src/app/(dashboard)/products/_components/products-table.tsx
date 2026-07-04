'use client';

import { useRouter } from 'next/navigation';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type OnChangeFn,
  type RowSelectionState,
} from '@tanstack/react-table';
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
import { productColumns, type ColumnMetaLayout } from './columns';
import type { AdminProductRow } from '@/types/product';

const metaClass = (col: { columnDef: { meta?: unknown } }) =>
  (col.columnDef.meta as ColumnMetaLayout | undefined)?.className;

export function ProductsTable({
  data,
  rowSelection,
  onRowSelectionChange,
  loading,
}: {
  data: AdminProductRow[];
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  loading: boolean;
}) {
  const router = useRouter();
  const table = useReactTable({
    data,
    columns: productColumns,
    state: { rowSelection },
    onRowSelectionChange,
    enableRowSelection: true,
    getRowId: (row) => row.id,
    // Every list concern is handled by the server; the table is a pure renderer.
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
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map((header) => (
                <TableHead key={header.id} className={cn(metaClass(header.column))}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: 8 }).map((_, r) => (
                <TableRow key={`sk-${r}`} className="hover:bg-transparent">
                  {productColumns.map((col, c) => (
                    <TableCell
                      key={c}
                      className={cn((col.meta as ColumnMetaLayout | undefined)?.className)}
                    >
                      {c === 1 ? (
                        <Skeleton className="h-10 w-10 rounded-md" />
                      ) : c === 0 ? (
                        <Skeleton className="h-4 w-4 rounded-sm" />
                      ) : (
                        <Skeleton className="h-4 w-full max-w-[8rem]" />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  className="group cursor-pointer"
                  onClick={() => router.push(`/products/${row.original.id}/edit`)}
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
