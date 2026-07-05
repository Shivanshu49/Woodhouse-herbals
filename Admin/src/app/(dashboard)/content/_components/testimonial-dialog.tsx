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
import { testimonials } from '@/hooks/use-content';
import type { Testimonial } from '@/types/content';
import { ContentImageField } from './content-image-field';

const selectCls = 'h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus:ring-2 focus:ring-ring';

export function TestimonialDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Testimonial | null;
}) {
  const create = testimonials.useCreate();
  const update = testimonials.useUpdate();
  const pending = create.isPending || update.isPending;

  const [authorName, setAuthorName] = useState('');
  const [authorMeta, setAuthorMeta] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [rating, setRating] = useState(''); // '' = no rating
  const [body, setBody] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setAuthorName(editing?.authorName ?? '');
    setAuthorMeta(editing?.authorMeta ?? '');
    setAvatarUrl(editing?.avatarUrl ?? null);
    setRating(editing?.rating != null ? String(editing.rating) : '');
    setBody(editing?.body ?? '');
    setActive(editing?.active ?? true);
  }, [open, editing]);

  const valid = !!authorName.trim() && !!body.trim();

  function submit() {
    if (!valid) return;
    const ratingNum = rating ? Number(rating) : undefined;
    const done = { onSuccess: () => onOpenChange(false) };
    if (editing) {
      update.mutate(
        {
          id: editing.id,
          body: {
            authorName: authorName.trim(),
            authorMeta,
            avatarUrl: avatarUrl ?? '',
            rating: ratingNum,
            body: body.trim(),
            active,
          },
        },
        done,
      );
    } else {
      create.mutate(
        {
          authorName: authorName.trim(),
          authorMeta: authorMeta || undefined,
          avatarUrl: avatarUrl ?? undefined,
          rating: ratingNum,
          body: body.trim(),
          active,
        },
        done,
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit testimonial' : 'New testimonial'}</DialogTitle>
          <DialogDescription>Customer quotes shown on the homepage.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="t-name">Author name</Label>
            <Input id="t-name" value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="t-meta">Meta (optional)</Label>
            <Input id="t-meta" value={authorMeta} onChange={(e) => setAuthorMeta(e.target.value)} placeholder="Verified · Mumbai" />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Avatar (optional)</Label>
          <ContentImageField value={avatarUrl} onChange={setAvatarUrl} folder="content" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="t-body">Quote</Label>
          <textarea
            id="t-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-md border bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="grid grid-cols-2 items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="t-rating">Rating (optional)</Label>
            <select id="t-rating" className={selectCls} value={rating} onChange={(e) => setRating(e.target.value)}>
              <option value="">— None —</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>{n} star{n === 1 ? '' : 's'}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Switch id="t-active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="t-active" className="text-sm">Active</Label>
          </div>
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
