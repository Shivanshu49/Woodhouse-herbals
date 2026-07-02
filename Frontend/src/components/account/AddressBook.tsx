'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { PROFILE_KEY } from '@/hooks/use-auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { AddressInput, CustomerAddress } from '@/types/auth';

const EMPTY: AddressInput = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
};

function AddressForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: AddressInput & { id?: string };
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<AddressInput>({ ...initial });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof AddressInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payload: AddressInput = {
        ...form,
        phone: form.phone.replace(/\D/g, '').slice(-10),
        line2: form.line2?.trim() || undefined,
      };
      if (initial.id) await api.customer.updateAddress(initial.id, payload);
      else await api.customer.createAddress(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save address.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-3xl border border-navy-900/10 bg-cream/60 p-5 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="Full name" value={form.fullName} onChange={set('fullName')} required minLength={2} maxLength={80} />
        <Input placeholder="10-digit phone" inputMode="numeric" value={form.phone} onChange={set('phone')} required pattern="(\+?91)?[6-9][0-9]{9}" />
      </div>
      <Input placeholder="Address line 1 (house, street)" value={form.line1} onChange={set('line1')} required minLength={3} maxLength={160} />
      <Input placeholder="Address line 2 (optional)" value={form.line2 ?? ''} onChange={set('line2')} maxLength={160} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Input placeholder="City" value={form.city} onChange={set('city')} required minLength={2} maxLength={80} />
        <Input placeholder="State" value={form.state} onChange={set('state')} required minLength={2} maxLength={60} />
        <Input placeholder="Pincode" inputMode="numeric" value={form.pincode} onChange={set('pincode')} required pattern="[1-9][0-9]{5}" />
      </div>
      {error ? (
        <p role="alert" className="rounded-2xl bg-blush-100 px-4 py-2.5 font-inter text-sm text-blush-600">{error}</p>
      ) : null}
      <div className="flex gap-3 pt-1">
        <Button type="submit" size="sm" loading={busy}>
          {initial.id ? 'Save address' : 'Add address'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AddressBook({ addresses }: { addresses: CustomerAddress[] }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'idle' | 'add' | string>('idle'); // string = editing that id
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    setMode('idle');
  };

  const remove = async (id: string) => {
    await api.customer.deleteAddress(id).catch(() => undefined);
    refresh();
  };
  const makeDefault = async (id: string) => {
    await api.customer.setDefaultAddress(id).catch(() => undefined);
    refresh();
  };

  return (
    <div className="space-y-4">
      {addresses.length === 0 && mode !== 'add' ? (
        <p className="font-inter text-sm text-ink-muted">
          No saved addresses yet — add one for faster checkout.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {addresses.map((a) =>
          mode === a.id ? (
            <div key={a.id} className="sm:col-span-2">
              <AddressForm
                initial={{ ...a, line2: a.line2 ?? '', id: a.id }}
                onCancel={() => setMode('idle')}
                onSaved={refresh}
              />
            </div>
          ) : (
            <div key={a.id} className="relative rounded-3xl border border-navy-900/10 bg-white p-5">
              {a.isDefault ? (
                <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-sage-100 px-2.5 py-1 font-inter text-[11px] font-bold uppercase tracking-wide text-brand-800">
                  <Star className="h-3 w-3 fill-current" /> Default
                </span>
              ) : null}
              <p className="flex items-center gap-2 font-inter font-semibold text-navy-900">
                <MapPin className="h-4 w-4 text-brand-600" />
                {a.fullName}
              </p>
              <p className="mt-2 font-inter text-sm text-ink-muted leading-relaxed">
                {a.line1}
                {a.line2 ? <>, {a.line2}</> : null}
                <br />
                {a.city}, {a.state} — {a.pincode}
                <br />
                +91 {a.phone.replace(/^\+91/, '')}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setMode(a.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-navy-900/10 px-3.5 h-9 font-inter text-xs font-semibold text-navy-900 hover:bg-cream"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                {!a.isDefault ? (
                  <>
                    <button
                      onClick={() => makeDefault(a.id)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-navy-900/10 px-3.5 h-9 font-inter text-xs font-semibold text-navy-900 hover:bg-cream"
                    >
                      <Star className="h-3.5 w-3.5" /> Make default
                    </button>
                    <button
                      onClick={() => remove(a.id)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-blush/40 px-3.5 h-9 font-inter text-xs font-semibold text-blush-600 hover:bg-blush-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ),
        )}
      </div>

      {mode === 'add' ? (
        <AddressForm initial={EMPTY} onCancel={() => setMode('idle')} onSaved={refresh} />
      ) : (
        <Button variant="secondary" size="sm" iconLeft={<Plus className="h-4 w-4" />} onClick={() => setMode('add')}>
          Add new address
        </Button>
      )}
    </div>
  );
}
