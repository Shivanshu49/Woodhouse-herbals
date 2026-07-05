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
import { banners } from '@/hooks/use-content';
import { isoToLocalInput, localToIso } from '@/lib/content-schedule';
import type { HeroBanner } from '@/types/content';
import { ContentImageField } from './content-image-field';
import { ScheduleFields } from './schedule-fields';

export function BannerDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: HeroBanner | null;
}) {
  const create = banners.useCreate();
  const update = banners.useUpdate();
  const pending = create.isPending || update.isPending;

  const [eyebrow, setEyebrow] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaHref, setCtaHref] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [accent, setAccent] = useState('');
  const [active, setActive] = useState(true);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  useEffect(() => {
    if (!open) return;
    setEyebrow(editing?.eyebrow ?? '');
    setTitle(editing?.title ?? '');
    setSubtitle(editing?.subtitle ?? '');
    setCtaLabel(editing?.ctaLabel ?? '');
    setCtaHref(editing?.ctaHref ?? '');
    setImageUrl(editing?.imageUrl ?? null);
    setAccent(editing?.accent ?? '');
    setActive(editing?.active ?? true);
    setStartsAt(isoToLocalInput(editing?.startsAt ?? null));
    setEndsAt(isoToLocalInput(editing?.endsAt ?? null));
  }, [open, editing]);

  const valid = !!title.trim() && !!ctaLabel.trim() && !!ctaHref.trim() && !!imageUrl;

  function submit() {
    if (!valid || !imageUrl) return;
    const done = { onSuccess: () => onOpenChange(false) };
    if (editing) {
      // Update: empty schedule fields are sent as '' to clear the stored bound.
      update.mutate(
        {
          id: editing.id,
          body: {
            eyebrow,
            title: title.trim(),
            subtitle,
            ctaLabel: ctaLabel.trim(),
            ctaHref: ctaHref.trim(),
            imageUrl,
            accent,
            active,
            startsAt: localToIso(startsAt) ?? '',
            endsAt: localToIso(endsAt) ?? '',
          },
        },
        done,
      );
    } else {
      create.mutate(
        {
          eyebrow,
          title: title.trim(),
          subtitle,
          ctaLabel: ctaLabel.trim(),
          ctaHref: ctaHref.trim(),
          imageUrl,
          accent: accent || undefined,
          active,
          startsAt: localToIso(startsAt),
          endsAt: localToIso(endsAt),
        },
        done,
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit banner' : 'New banner'}</DialogTitle>
          <DialogDescription>Hero banners appear at the top of the storefront homepage.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Label>Image</Label>
          <ContentImageField value={imageUrl} onChange={setImageUrl} folder="banners" aspect="wide" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="b-eyebrow">Eyebrow</Label>
          <Input id="b-eyebrow" value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} placeholder="New arrival" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="b-title">Title</Label>
          <Input id="b-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="b-subtitle">Subtitle</Label>
          <textarea
            id="b-subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="b-cta-label">CTA label</Label>
            <Input id="b-cta-label" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Shop now" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="b-cta-href">CTA link</Label>
            <Input id="b-cta-href" value={ctaHref} onChange={(e) => setCtaHref(e.target.value)} placeholder="/shop" />
          </div>
        </div>

        <div className="grid grid-cols-2 items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="b-accent">Accent (optional)</Label>
            <Input id="b-accent" value={accent} onChange={(e) => setAccent(e.target.value)} placeholder="forest" />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Switch id="b-active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="b-active" className="text-sm">Active</Label>
          </div>
        </div>

        <ScheduleFields startsAt={startsAt} endsAt={endsAt} onStartsAt={setStartsAt} onEndsAt={setEndsAt} />

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
