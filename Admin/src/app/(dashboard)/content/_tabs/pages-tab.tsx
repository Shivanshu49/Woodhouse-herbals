'use client';

import { useState } from 'react';
import { FileText, Pencil, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { pages } from '@/hooks/use-content';
import type { StaticPage } from '@/types/content';
import { PageDialog } from '../_components/page-dialog';
import { ConfirmDelete } from '../_components/confirm-delete';

export function PagesTab() {
  const { data, isLoading } = pages.useList();
  const update = pages.useUpdate();
  const del = pages.useRemove();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaticPage | null>(null);
  const [deleting, setDeleting] = useState<StaticPage | null>(null);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Policy &amp; info pages, addressed by slug (about, privacy, terms…).</p>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          New page
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={FileText} title="No pages yet" description="Create pages like About, Privacy policy, or Terms." />
      ) : (
        <div className="space-y-2">
          {data.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-md border p-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{p.title}</span>
                  {!p.published && <span className="text-xs text-amber-600">draft</span>}
                </div>
                <div className="truncate text-xs text-muted-foreground">/{p.slug}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={p.published}
                  onCheckedChange={(v) => update.mutate({ id: p.id, body: { published: v } })}
                  aria-label="Published"
                />
                <span className="hidden text-xs text-muted-foreground sm:inline">Published</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setDialogOpen(true); }} aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleting(p)} aria-label="Delete">
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <PageDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete page"
        description={`Delete “${deleting?.title ?? ''}”? This can’t be undone.`}
        pending={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </div>
  );
}
