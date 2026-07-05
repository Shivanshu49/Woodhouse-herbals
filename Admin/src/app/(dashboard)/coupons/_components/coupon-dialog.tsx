'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { rupeesToPaise, paiseToRupees } from '@/lib/money';
import { isoToLocalInput, localToIso } from '@/lib/content-schedule';
import { useCreateCoupon, useUpdateCoupon } from '@/hooks/use-coupons';
import type { CouponDetail, CouponKind, CreateCouponBody } from '@/types/coupon';

const selectCls = 'h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus:ring-2 focus:ring-ring';
const CODE_RE = /^[A-Z0-9_-]{3,32}$/;
const num = (s: string): number | undefined => (s.trim() ? Math.floor(Number(s)) : undefined);

export function CouponDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: CouponDetail | null;
}) {
  const create = useCreateCoupon();
  const update = useUpdateCoupon(editing?.id ?? '');
  const pending = create.isPending || update.isPending;
  const cats = useQuery({ queryKey: qk.categories, queryFn: api.categories.list });

  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<CouponKind>('PERCENT');
  const [value, setValue] = useState(''); // percent number, or rupees for FLAT
  const [maxDiscount, setMaxDiscount] = useState(''); // rupees, PERCENT only
  const [minCart, setMinCart] = useState(''); // rupees
  const [maxUses, setMaxUses] = useState('');
  const [perUserLimit, setPerUserLimit] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [active, setActive] = useState(true);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setCode(editing?.code ?? '');
    setDescription(editing?.description ?? '');
    setKind(editing?.kind ?? 'PERCENT');
    setValue(editing ? (editing.kind === 'PERCENT' ? String(editing.value) : paiseToRupees(editing.value)) : '');
    setMaxDiscount(editing?.maxDiscountMinor != null ? paiseToRupees(editing.maxDiscountMinor) : '');
    setMinCart(editing && editing.minCartMinor > 0 ? paiseToRupees(editing.minCartMinor) : '');
    setMaxUses(editing?.maxUses != null ? String(editing.maxUses) : '');
    setPerUserLimit(editing?.perUserLimit != null ? String(editing.perUserLimit) : '');
    setStartsAt(isoToLocalInput(editing?.startsAt ?? null));
    setExpiresAt(isoToLocalInput(editing?.expiresAt ?? null));
    setActive(editing?.active ?? true);
    setCategoryIds(editing?.categories.map((c) => c.id) ?? []);
  }, [open, editing]);

  // Derive the parsed discount value + a per-field validity note.
  const percentValid = kind !== 'PERCENT' || (/^\d+$/.test(value.trim()) && +value >= 1 && +value <= 100);
  const flatPaise = kind === 'FLAT' ? rupeesToPaise(value) : null;
  const flatValid = kind !== 'FLAT' || (flatPaise !== null && flatPaise >= 1);
  const codeValid = !editing ? CODE_RE.test(code.trim().toUpperCase()) : true;
  const valid = codeValid && value.trim() !== '' && percentValid && flatValid;

  function toggleCat(id: string) {
    setCategoryIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function submit() {
    if (!valid) return;
    const discountValue = kind === 'PERCENT' ? Math.floor(Number(value)) : (flatPaise as number);
    const body: CreateCouponBody = {
      code: code.trim().toUpperCase(),
      description: description.trim() || undefined,
      kind,
      value: discountValue,
      maxDiscountMinor: kind === 'PERCENT' && maxDiscount.trim() ? rupeesToPaise(maxDiscount) ?? undefined : undefined,
      minCartMinor: minCart.trim() ? rupeesToPaise(minCart) ?? 0 : 0,
      maxUses: num(maxUses),
      perUserLimit: num(perUserLimit),
      startsAt: localToIso(startsAt),
      expiresAt: localToIso(expiresAt),
      active,
      categoryIds,
    };
    const done = { onSuccess: () => onOpenChange(false) };
    if (editing) {
      // Send the full enforced set (backend merges); omit the immutable code.
      const { code: _code, ...rest } = body;
      update.mutate(rest, done);
    } else {
      create.mutate(body, done);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.code}` : 'New coupon'}</DialogTitle>
          <DialogDescription>
            Only PERCENT / FLAT discounts with a category restriction and usage limits are enforced at checkout.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="c-code">Code</Label>
            <Input
              id="c-code"
              value={code}
              disabled={!!editing}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="WELCOME15"
              className={!codeValid && code ? 'border-red-500' : ''}
            />
            {editing && <p className="text-xs text-muted-foreground">Code can’t be changed.</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="c-desc">Description (optional)</Label>
            <Input id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="c-kind">Type</Label>
            <select id="c-kind" className={selectCls} value={kind} onChange={(e) => setKind(e.target.value as CouponKind)}>
              <option value="PERCENT">Percentage off</option>
              <option value="FLAT">Fixed amount off</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="c-value">{kind === 'PERCENT' ? 'Percent (1–100)' : 'Amount (₹)'}</Label>
            <Input
              id="c-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="decimal"
              placeholder={kind === 'PERCENT' ? '15' : '100'}
              className={value && !(percentValid && flatValid) ? 'border-red-500' : ''}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {kind === 'PERCENT' && (
            <div className="space-y-1">
              <Label htmlFor="c-cap">Max discount (₹, optional)</Label>
              <Input id="c-cap" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} inputMode="decimal" placeholder="200" />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="c-min">Min cart total (₹, optional)</Label>
            <Input id="c-min" value={minCart} onChange={(e) => setMinCart(e.target.value)} inputMode="decimal" placeholder="500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="c-maxuses">Total uses (blank = unlimited)</Label>
            <Input id="c-maxuses" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} inputMode="numeric" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="c-peruser">Per-customer limit (blank = none)</Label>
            <Input id="c-peruser" value={perUserLimit} onChange={(e) => setPerUserLimit(e.target.value)} inputMode="numeric" />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Schedule (optional)</Label>
          <div className="grid grid-cols-2 gap-3">
            <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} aria-label="Starts at" />
            <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} aria-label="Expires at" />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Restrict to categories (optional)</Label>
          {cats.data && cats.data.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {cats.data.map((cat) => {
                const on = categoryIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCat(cat.id)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No categories yet — the coupon applies to the whole cart.</p>
          )}
          {categoryIds.length > 0 && (
            <p className="text-xs text-muted-foreground">Applies only to the {categoryIds.length} selected categor{categoryIds.length === 1 ? 'y' : 'ies'}.</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Switch id="c-active" checked={active} onCheckedChange={setActive} />
          <Label htmlFor="c-active" className="text-sm">Active</Label>
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
