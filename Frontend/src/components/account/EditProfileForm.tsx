'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { PROFILE_KEY } from '@/hooks/use-auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { CustomerProfile, SkinType } from '@/types/auth';

const SKIN_TYPES: { value: SkinType; label: string }[] = [
  { value: 'OILY', label: 'Oily' },
  { value: 'DRY', label: 'Dry' },
  { value: 'COMBINATION', label: 'Combination' },
  { value: 'SENSITIVE', label: 'Sensitive' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'ALL', label: 'Not sure / all types' },
];

export function EditProfileForm({ profile }: { profile: CustomerProfile }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone?.replace(/^\+91/, '') ?? '');
  const [skinType, setSkinType] = useState<SkinType | ''>(profile.skinType ?? '');
  const [concerns, setConcerns] = useState(profile.primaryConcerns.join(', '));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const updated = await api.customer.updateProfile({
        fullName: fullName.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(skinType ? { skinType } : {}),
        primaryConcerns: concerns
          .split(',')
          .map((c) => c.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 8),
      });
      queryClient.setQueryData(PROFILE_KEY, updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const labelCls = 'block font-inter text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1.5 px-2';

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pf-name" className={labelCls}>Full name</label>
          <Input
            id="pf-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            minLength={2}
            maxLength={80}
          />
        </div>
        <div>
          <label htmlFor="pf-phone" className={labelCls}>Phone</label>
          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 font-inter text-[15px] text-ink-muted">+91</span>
            <Input
              id="pf-phone"
              type="tel"
              inputMode="numeric"
              className="pl-14"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              pattern="[6-9][0-9]{9}"
              title="10-digit Indian mobile number"
              placeholder="Add your number"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pf-skin" className={labelCls}>Skin type</label>
          <select
            id="pf-skin"
            value={skinType}
            onChange={(e) => setSkinType(e.target.value as SkinType | '')}
            className="h-12 w-full rounded-full border bg-white px-5 text-[15px] text-ink border-navy-900/15 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 focus:outline-none"
          >
            <option value="">Select…</option>
            {SKIN_TYPES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pf-concerns" className={labelCls}>Skin concerns (comma separated)</label>
          <Input
            id="pf-concerns"
            value={concerns}
            onChange={(e) => setConcerns(e.target.value)}
            placeholder="acne, dullness, tan"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 pt-1">
        <Button type="submit" loading={busy}>Save changes</Button>
        {saved ? <span className="font-inter text-sm text-brand-700">Saved ✓</span> : null}
      </div>
      {error ? (
        <p role="alert" className="rounded-2xl bg-blush-100 px-4 py-2.5 font-inter text-sm text-blush-600">{error}</p>
      ) : null}
    </form>
  );
}
