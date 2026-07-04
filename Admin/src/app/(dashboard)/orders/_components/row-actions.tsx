'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Eye, MoreHorizontal, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { canCancelOrderStatus } from '@/lib/order-badges';
import type { AdminOrderRow } from '@/types/order';
import { AddNoteDialog } from './add-note-dialog';
import { CancelOrderDialog } from './cancel-order-dialog';

export function RowActions({ row }: { row: AdminOrderRow }) {
  const router = useRouter();
  const [noteOpen, setNoteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const cancellable = canCancelOrderStatus(row.status);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={() => router.push(`/orders/${row.id}`)}>
            <Eye className="mr-2 h-4 w-4" />
            View
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setNoteOpen(true)}>
            <StickyNote className="mr-2 h-4 w-4" />
            Add note
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!cancellable}
            onSelect={() => {
              if (cancellable) setCancelOpen(true);
            }}
            className="text-destructive focus:text-destructive"
          >
            <Ban className="mr-2 h-4 w-4" />
            Cancel order
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AddNoteDialog order={row} open={noteOpen} onOpenChange={setNoteOpen} />
      <CancelOrderDialog order={row} open={cancelOpen} onOpenChange={setCancelOpen} />
    </>
  );
}
