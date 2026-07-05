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
import { offerStrip } from '@/hooks/use-content';
import { isoToLocalInput, localToIso } from '@/lib/content-schedule';
import type { OfferStripItem } from '@/types/content';
import { ScheduleFields } from './schedule-fields';

export function OfferStripDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: OfferStripItem | null;
}) {
  const create = offerStrip.useCreate();
  const update = offerStrip.useUpdate();
  const pending = create.isPending || update.isPending;

  const [headline, setHeadline] = useState('');
  const [code, setCode] = useState('');
  const [href, setHref] = useState('');
  const [active, setActive] = useState(true);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  useEffect(() => {
    if (!open) return;
    setHeadline(editing?.headline ?? '');
    setCode(editing?.code ?? '');
    setHref(editing?.href ?? '');
    setActive(editing?.active ?? true);
    setStartsAt(isoToLocalInput(editing?.startsAt ?? null));
    setEndsAt(isoToLocalInput(editing?.endsAt ?? null));
  }, [open, editing]);

  const valid = !!headline.trim();

  function submit() {
    if (!valid) return;
    const done = { onSuccess: () => onOpenChange(false) };
    if (editing) {
      update.mutate(
        {
          id: editing.id,
          body: {
            headline: headline.trim(),
            code,
            href,
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
          headline: headline.trim(),
          code: code || undefined,
          href: href || undefined,
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit offer' : 'New offer'}</DialogTitle>
          <DialogDescription>Offer-strip items scroll along the promo ribbon above the header.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Label htmlFor="o-headline">Headline</Label>
          <Input id="o-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Free shipping over ₹499" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="o-code">Promo code (optional)</Label>
            <Input id="o-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="FREESHIP" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="o-href">Link</Label>
            <Input id="o-href" value={href} onChange={(e) => setHref(e.target.value)} placeholder="/shop" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch id="o-active" checked={active} onCheckedChange={setActive} />
          <Label htmlFor="o-active" className="text-sm">Active</Label>
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
