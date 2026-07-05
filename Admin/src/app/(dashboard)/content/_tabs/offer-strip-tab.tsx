'use client';

import { useState } from 'react';
import { Megaphone, Pencil, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { offerStrip } from '@/hooks/use-content';
import type { OfferStripItem } from '@/types/content';
import { SortableList } from '../_components/sortable-list';
import { OfferStripDialog } from '../_components/offer-strip-dialog';
import { ConfirmDelete } from '../_components/confirm-delete';

export function OfferStripTab() {
  const { data, isLoading } = offerStrip.useList();
  const reorder = offerStrip.useReorder();
  const update = offerStrip.useUpdate();
  const del = offerStrip.useRemove();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OfferStripItem | null>(null);
  const [deleting, setDeleting] = useState<OfferStripItem | null>(null);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Short promo messages scrolling above the header. Drag to reorder.
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          New offer
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No offers yet"
          description="Add promo messages like “Free shipping over ₹499”."
        />
      ) : (
        <SortableList
          items={data}
          onReorder={(items) => reorder.mutate({ items })}
          renderRow={(o, handle) => (
            <div className="flex items-center gap-3 rounded-md border p-2">
              {handle}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{o.headline}</span>
                  {!o.active && <span className="text-xs text-amber-600">hidden</span>}
                  {(o.startsAt || o.endsAt) && <span className="text-xs text-muted-foreground">· scheduled</span>}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {o.code ? `${o.code} · ` : ''}{o.href}
                </div>
              </div>
              <Switch
                checked={o.active}
                onCheckedChange={(v) => update.mutate({ id: o.id, body: { active: v } })}
                aria-label="Active"
              />
              <Button size="sm" variant="ghost" onClick={() => { setEditing(o); setDialogOpen(true); }} aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleting(o)} aria-label="Delete">
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          )}
        />
      )}

      <OfferStripDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete offer"
        description={`Delete “${deleting?.headline ?? ''}”? This can’t be undone.`}
        pending={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </div>
  );
}
