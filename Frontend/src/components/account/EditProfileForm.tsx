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

const labelCls = 'block font-inter text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1.5 px-2';

/**
 * Phone is a LOGIN identifier (OTP sign-in), so it changes through its own
 * possession-proof flow: send a code to the new number, verify, saved.
 * It is deliberately not part of the main profile save.
 */
function PhoneChanger({ currentPhone }: { currentPhone: string | null }) {
  const queryClient = useQueryClient();
  const saved = currentPhone?.replace(/^\+91/, '') ?? '';
  const [draft, setDraft] = useState(saved);
  const [stage, setStage] = useState<'idle' | 'code'>('idle');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dirty = draft !== saved && draft.length === 10;

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setMsg(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      const res = await api.auth.phoneChangeRequest(draft);
      setDevCode(res.devCode ?? null);
      setStage('code');
    });

  const verify = () =>
    run(async () => {
      await api.auth.phoneChangeVerify({ phone: draft, code });
      await queryClient.refetchQueries({ queryKey: PROFILE_KEY });
      setStage('idle');
      setCode('');
      setDevCode(null);
      setMsg('Phone updated ✓');
    });

  return (
    <div>
      <label htmlFor="pf-phone" className={labelCls}>
        Phone (used for OTP sign-in, verified by code)
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 font-inter text-[15px] text-ink-muted">+91</span>
          <Input
            id="pf-phone"
            type="tel"
            inputMode="numeric"
            className="pl-14"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value.replace(/\D/g, '').slice(0, 10));
              setStage('idle');
              setMsg(null);
            }}
            pattern="[6-9][0-9]{9}"
            title="10-digit Indian mobile number"
            placeholder="Add your number"
          />
        </div>
        {dirty && stage === 'idle' ? (
          <Button type="button" size="md" variant="secondary" loading={busy} onClick={sendCode}>
            Verify
          </Button>
        ) : null}
      </div>

      {stage === 'code' ? (
        <div className="mt-3 space-y-2">
          {devCode ? (
            <p className="rounded-2xl bg-sage-100 px-4 py-2 font-inter text-sm text-brand-800">
              Dev mode: your code is <strong data-testid="dev-otp-change">{devCode}</strong>
            </p>
          ) : (
            <p className="font-inter text-sm text-ink-muted">Enter the 6-digit code we sent to +91 {draft}.</p>
          )}
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center tracking-[0.4em] font-semibold max-w-[12rem]"
            />
            <Button type="button" size="md" loading={busy} disabled={code.length !== 6} onClick={verify}>
              Confirm
            </Button>
          </div>
        </div>
      ) : null}

      {msg ? <p className="mt-2 px-2 font-inter text-sm text-brand-700">{msg}</p> : null}
      {error ? (
        <p role="alert" className="mt-2 rounded-2xl bg-blush-100 px-4 py-2.5 font-inter text-sm text-blush-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function EditProfileForm({ profile }: { profile: CustomerProfile }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(profile.fullName);
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

  return (
    <div className="space-y-6">
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

        <div className="flex items-center gap-4 pt-1">
          <Button type="submit" loading={busy}>Save changes</Button>
          {saved ? <span className="font-inter text-sm text-brand-700">Saved ✓</span> : null}
        </div>
        {error ? (
          <p role="alert" className="rounded-2xl bg-blush-100 px-4 py-2.5 font-inter text-sm text-blush-600">{error}</p>
        ) : null}
      </form>

      <div className="border-t border-navy-900/8 pt-6">
        <PhoneChanger currentPhone={profile.phone} />
      </div>
    </div>
  );
}
