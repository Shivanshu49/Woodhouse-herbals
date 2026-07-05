'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { pages } from '@/hooks/use-content';
import type { StaticPage } from '@/types/content';

const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function PageDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: StaticPage | null;
}) {
  const create = pages.useCreate();
  const update = pages.useUpdate();
  const pending = create.isPending || update.isPending;

  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [title, setTitle] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [published, setPublished] = useState(true);

  useEffect(() => {
    if (!open) return;
    setSlug(editing?.slug ?? '');
    setSlugTouched(!!editing);
    setTitle(editing?.title ?? '');
    setBodyHtml(editing?.bodyHtml ?? '');
    setMetaTitle(editing?.metaTitle ?? '');
    setMetaDescription(editing?.metaDescription ?? '');
    setPublished(editing?.published ?? true);
  }, [open, editing]);

  // Auto-derive slug from title until the user edits the slug directly.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  const valid = !!slug && !!title.trim() && !!bodyHtml.trim();

  function submit() {
    if (!valid) return;
    const done = { onSuccess: () => onOpenChange(false) };
    const shared = {
      slug,
      title: title.trim(),
      bodyHtml,
      metaTitle: editing ? metaTitle : metaTitle || undefined,
      metaDescription: editing ? metaDescription : metaDescription || undefined,
      published,
    };
    if (editing) update.mutate({ id: editing.id, body: shared }, done);
    else create.mutate(shared, done);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit page' : 'New page'}</DialogTitle>
          <DialogDescription>Policy &amp; info pages (about, privacy, terms…). The body accepts HTML.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="p-title">Title</Label>
            <Input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-slug">Slug</Label>
            <Input
              id="p-slug"
              value={slug}
              onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
              placeholder="privacy-policy"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="p-body">Body (HTML)</Label>
          <textarea
            id="p-body"
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            rows={10}
            className="w-full resize-y rounded-md border bg-transparent p-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="p-meta-title">Meta title (optional)</Label>
          <Input id="p-meta-title" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="p-meta-desc">Meta description (optional)</Label>
          <textarea
            id="p-meta-desc"
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch id="p-published" checked={published} onCheckedChange={setPublished} />
          <Label htmlFor="p-published" className="text-sm">Published (visible on storefront)</Label>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={!valid || pending}>
            {pending ? 'Saving…' : editing ? 'Save' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
