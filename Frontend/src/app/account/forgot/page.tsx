'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AuthError, AuthFooterLink, AuthShell } from '@/components/auth/AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.auth.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      titleBold="Reset"
      titleItalic="password."
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <>
          Remembered it? <AuthFooterLink href="/login">Sign in</AuthFooterLink>
        </>
      }
    >
      {sent ? (
        <p className="py-4 text-center font-inter text-[15px] text-ink-muted leading-relaxed">
          If an account exists for <span className="font-semibold text-navy-900">{email}</span>, a
          reset link is on its way. The link expires in 1 hour.
        </p>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <Input
            type="email"
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
      <AuthError message={error} />
    </AuthShell>
  );
}
