'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from './confirm-dialog';
import { useDeleteProduct, useRestoreProduct } from '@/hooks/use-product-mutations';
import type { AdminProductRow } from '@/types/product';

export function RowActions({ row }: { row: AdminProductRow }) {
  const router = useRouter();
  const del = useDeleteProduct();
  const restore = useRestoreProduct();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const archived = !!row.deletedAt;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => e.stopPropagation()}
            aria-label="Row actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={() => router.push(`/products/${row.id}/edit`)}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          {/* Duplicate lands with the product editor in a later step. */}
          <DropdownMenuItem disabled>
            <Copy />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {archived ? (
            <DropdownMenuItem onSelect={() => restore.mutate(row.id)}>
              <RotateCcw />
              Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setConfirmDelete(true)}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this product?"
        description={`"${row.name}" will be archived (soft-deleted) and drop off the storefront. You can restore it anytime from the Archived filter.`}
        confirmLabel="Delete"
        destructive
        pending={del.isPending}
        onConfirm={() => del.mutate(row.id, { onSuccess: () => setConfirmDelete(false) })}
      />
    </>
  );
}
