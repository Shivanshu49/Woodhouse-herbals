'use client';

import { useState } from 'react';
import { ImageIcon, Pencil, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { banners } from '@/hooks/use-content';
import type { HeroBanner } from '@/types/content';
import { SortableList } from '../_components/sortable-list';
import { BannerDialog } from '../_components/banner-dialog';
import { ConfirmDelete } from '../_components/confirm-delete';

export function BannersTab() {
  const { data, isLoading } = banners.useList();
  const reorder = banners.useReorder();
  const update = banners.useUpdate();
  const del = banners.useRemove();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HeroBanner | null>(null);
  const [deleting, setDeleting] = useState<HeroBanner | null>(null);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          The hero slides shown at the top of the homepage. Drag to reorder.
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          New banner
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No banners yet"
          description="Add a hero banner with an image, headline, and call-to-action."
        />
      ) : (
        <SortableList
          items={data}
          onReorder={(items) => reorder.mutate({ items })}
          renderRow={(b, handle) => (
            <div className="flex items-center gap-3 rounded-md border p-2">
              {handle}
              {b.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.imageUrl} alt="" className="h-10 w-16 rounded object-cover" />
              ) : (
                <div className="h-10 w-16 rounded bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{b.title || '(untitled)'}</span>
                  {!b.active && <span className="text-xs text-amber-600">hidden</span>}
                  {(b.startsAt || b.endsAt) && <span className="text-xs text-muted-foreground">· scheduled</span>}
                </div>
                <div className="truncate text-xs text-muted-foreground">{b.eyebrow || b.ctaHref}</div>
              </div>
              <Switch
                checked={b.active}
                onCheckedChange={(v) => update.mutate({ id: b.id, body: { active: v } })}
                aria-label="Active"
              />
              <Button size="sm" variant="ghost" onClick={() => { setEditing(b); setDialogOpen(true); }} aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleting(b)} aria-label="Delete">
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          )}
        />
      )}

      <BannerDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete banner"
        description={`Delete “${deleting?.title ?? ''}”? This can’t be undone.`}
        pending={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </div>
  );
}
