'use client';

import { useState } from 'react';
import { HelpCircle, Pencil, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { faqs } from '@/hooks/use-content';
import type { Faq } from '@/types/content';
import { SortableList } from '../_components/sortable-list';
import { FaqDialog } from '../_components/faq-dialog';
import { ConfirmDelete } from '../_components/confirm-delete';

export function FaqsTab() {
  const { data, isLoading } = faqs.useList();
  const reorder = faqs.useReorder();
  const update = faqs.useUpdate();
  const del = faqs.useRemove();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Faq | null>(null);
  const [deleting, setDeleting] = useState<Faq | null>(null);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Questions &amp; answers for shoppers. Drag to reorder.</p>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          New FAQ
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={HelpCircle} title="No FAQs yet" description="Add common questions like shipping, returns, or product usage." />
      ) : (
        <SortableList
          items={data}
          onReorder={(items) => reorder.mutate({ items })}
          renderRow={(f, handle) => (
            <div className="flex items-center gap-3 rounded-md border p-2">
              {handle}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{f.question}</span>
                  {f.category && <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{f.category}</span>}
                  {!f.active && <span className="text-xs text-amber-600">hidden</span>}
                </div>
                <div className="truncate text-xs text-muted-foreground">{f.answer}</div>
              </div>
              <Switch
                checked={f.active}
                onCheckedChange={(v) => update.mutate({ id: f.id, body: { active: v } })}
                aria-label="Active"
              />
              <Button size="sm" variant="ghost" onClick={() => { setEditing(f); setDialogOpen(true); }} aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleting(f)} aria-label="Delete">
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          )}
        />
      )}

      <FaqDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete FAQ"
        description={`Delete “${deleting?.question ?? ''}”? This can’t be undone.`}
        pending={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </div>
  );
}
