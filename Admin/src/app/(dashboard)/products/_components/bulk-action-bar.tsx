'use client';

import { useState } from 'react';
import { Archive, CheckCircle2, FileText, FolderTree, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBulkProducts } from '@/hooks/use-product-mutations';
import { SetCategoryDialog } from './set-category-dialog';
import type { BulkAction } from '@/types/product';

/**
 * Floating action bar shown while rows are selected. In the live views it
 * offers Publish / Draft / Archive; in the Archived view it offers Restore.
 * "Archive" is the soft-delete — there is no separate hard delete.
 */
export function BulkActionBar({
  ids,
  archivedView,
  onClear,
}: {
  ids: string[];
  archivedView: boolean;
  onClear: () => void;
}) {
  const bulk = useBulkProducts();
  const [catOpen, setCatOpen] = useState(false);
  const count = ids.length;

  function run(action: BulkAction) {
    bulk.mutate({ ids, action }, { onSuccess: onClear });
  }

  return (
    <>
      <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-popover px-3 py-2 text-popover-foreground shadow-lg">
        <span className="flex items-center gap-2 px-1 text-sm">
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
            {count}
          </span>
          selected
        </span>
        <span className="mx-1 h-5 w-px bg-border" />
        {archivedView ? (
          <Button variant="ghost" size="sm" disabled={bulk.isPending} onClick={() => run('restore')}>
            <RotateCcw className="h-4 w-4" />
            Restore
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={bulk.isPending}
              onClick={() => run('publish')}
            >
              <CheckCircle2 className="h-4 w-4" />
              Publish
            </Button>
            <Button variant="ghost" size="sm" disabled={bulk.isPending} onClick={() => run('draft')}>
              <FileText className="h-4 w-4" />
              Draft
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={bulk.isPending}
              onClick={() => run('archive')}
            >
              <Archive className="h-4 w-4" />
              Archive
            </Button>
          </>
        )}
        <Button variant="ghost" size="sm" disabled={bulk.isPending} onClick={() => setCatOpen(true)}>
          <FolderTree className="h-4 w-4" />
          Set category
        </Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClear}
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <SetCategoryDialog
        open={catOpen}
        onOpenChange={setCatOpen}
        count={count}
        pending={bulk.isPending}
        onSubmit={(categoryId) =>
          bulk.mutate(
            { ids, action: 'set-category', categoryId },
            {
              onSuccess: () => {
                setCatOpen(false);
                onClear();
              },
            },
          )
        }
      />
    </>
  );
}
