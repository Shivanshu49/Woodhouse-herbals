'use client';

import { useState } from 'react';
import { Quote, Pencil, Trash2, Star } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { testimonials } from '@/hooks/use-content';
import type { Testimonial } from '@/types/content';
import { SortableList } from '../_components/sortable-list';
import { TestimonialDialog } from '../_components/testimonial-dialog';
import { ConfirmDelete } from '../_components/confirm-delete';

export function TestimonialsTab() {
  const { data, isLoading } = testimonials.useList();
  const reorder = testimonials.useReorder();
  const update = testimonials.useUpdate();
  const del = testimonials.useRemove();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [deleting, setDeleting] = useState<Testimonial | null>(null);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Customer quotes on the homepage. Drag to reorder.</p>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          New testimonial
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={Quote} title="No testimonials yet" description="Add a customer quote with an optional avatar and rating." />
      ) : (
        <SortableList
          items={data}
          onReorder={(items) => reorder.mutate({ items })}
          renderRow={(t, handle) => (
            <div className="flex items-center gap-3 rounded-md border p-2">
              {handle}
              {t.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{t.authorName}</span>
                  {t.rating != null && (
                    <span className="flex items-center gap-0.5 text-xs text-amber-500">
                      {t.rating}
                      <Star className="h-3 w-3 fill-current" />
                    </span>
                  )}
                  {!t.active && <span className="text-xs text-amber-600">hidden</span>}
                </div>
                <div className="truncate text-xs text-muted-foreground">{t.body}</div>
              </div>
              <Switch
                checked={t.active}
                onCheckedChange={(v) => update.mutate({ id: t.id, body: { active: v } })}
                aria-label="Active"
              />
              <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setDialogOpen(true); }} aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleting(t)} aria-label="Delete">
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          )}
        />
      )}

      <TestimonialDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete testimonial"
        description={`Delete the testimonial from “${deleting?.authorName ?? ''}”? This can’t be undone.`}
        pending={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </div>
  );
}
