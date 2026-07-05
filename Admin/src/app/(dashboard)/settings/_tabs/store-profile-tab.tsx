'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useStoreProfile, useUpdateStoreProfile } from '@/hooks/use-settings';
import { INDIAN_STATE_NAMES, isValidGstin } from '@/lib/indian-states';
import type { StoreProfilePatch } from '@/types/settings';

const RATES = [0, 5, 12, 18, 28];
const selectCls =
  'h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus:ring-2 focus:ring-ring';

export function StoreProfileTab() {
  const { data, isLoading } = useStoreProfile();
  const save = useUpdateStoreProfile();

  const [form, setForm] = useState<StoreProfilePatch>({});
  useEffect(() => {
    if (data) {
      setForm({
        legalName: data.legalName ?? '',
        gstin: data.gstin ?? '',
        pan: data.pan ?? '',
        address: data.address ?? '',
        state: data.state ?? '',
        shippingGstRate: data.shippingGstRate,
      });
    }
  }, [data]);

  if (isLoading) return <Skeleton className="h-96 w-full max-w-2xl" />;

  const set = (patch: StoreProfilePatch) => setForm((f) => ({ ...f, ...patch }));
  const gstinInvalid = !!form.gstin && !isValidGstin(form.gstin);

  function submit() {
    // Only send filled fields — never overwrite a value with an empty string.
    const patch: StoreProfilePatch = {};
    if (form.legalName?.trim()) patch.legalName = form.legalName.trim();
    if (form.gstin?.trim()) patch.gstin = form.gstin.trim();
    if (form.pan?.trim()) patch.pan = form.pan.trim();
    if (form.address?.trim()) patch.address = form.address.trim();
    if (form.state?.trim()) patch.state = form.state.trim();
    if (form.shippingGstRate !== undefined) patch.shippingGstRate = form.shippingGstRate;
    save.mutate(patch);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        These values appear on every GST invoice. Invoice generation returns a 503 until the
        legal name, GSTIN, address, and state are all set.
      </div>

      <div className="space-y-1">
        <Label htmlFor="legalName">Legal name</Label>
        <Input
          id="legalName"
          value={form.legalName ?? ''}
          onChange={(e) => set({ legalName: e.target.value })}
          placeholder="Wood House Herbals Pvt Ltd"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="gstin">GSTIN</Label>
          <Input
            id="gstin"
            value={form.gstin ?? ''}
            onChange={(e) => set({ gstin: e.target.value.toUpperCase() })}
            placeholder="29ABCDE1234F1Z5"
            className={gstinInvalid ? 'border-red-500' : ''}
          />
          {gstinInvalid && <p className="text-xs text-red-600">Not a valid 15-character GSTIN.</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="pan">PAN</Label>
          <Input
            id="pan"
            value={form.pan ?? ''}
            onChange={(e) => set({ pan: e.target.value.toUpperCase() })}
            placeholder="ABCDE1234F"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="address">Registered address</Label>
        <textarea
          id="address"
          value={form.address ?? ''}
          onChange={(e) => set({ address: e.target.value })}
          rows={2}
          placeholder="12 Herbal Road, Bengaluru, Karnataka 560038"
          className="w-full resize-none rounded-md border bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="state">State (place of supply)</Label>
          <select
            id="state"
            value={form.state ?? ''}
            onChange={(e) => set({ state: e.target.value })}
            className={selectCls}
          >
            <option value="">Select a state…</option>
            {INDIAN_STATE_NAMES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            State code {data?.stateCode ?? '—'} (derived) drives CGST/SGST vs IGST.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="rate">Shipping GST rate</Label>
          <select
            id="rate"
            value={form.shippingGstRate ?? 18}
            onChange={(e) => set({ shippingGstRate: Number(e.target.value) })}
            className={selectCls}
          >
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r}%
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={gstinInvalid || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save store profile'}
        </Button>
      </div>
    </div>
  );
}
