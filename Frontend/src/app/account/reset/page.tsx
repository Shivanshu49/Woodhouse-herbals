'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AuthError, AuthFooterLink, AuthShell } from '@/components/auth/AuthShell';

function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.auth.resetPassword({ token, password });
      router.replace('/login');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      titleBold="Choose a new"
      titleItalic="password."
      footer={
        <>
          Link expired? <AuthFooterLink href="/account/forgot">Request a new one</AuthFooterLink>
        </>
      }
    >
      {!token ? (
        <p className="py-4 text-center font-inter text-[15px] text-ink-muted">
          This reset link is missing its token — please use the link from your email.
        </p>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={10}
              maxLength={128}
            />
            <p className="mt-1.5 px-2 font-inter text-xs text-ink-subtle">
              At least 10 characters with an uppercase letter, a lowercase letter and a number.
            </p>
          </div>
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Set new password
          </Button>
        </form>
      )}
      <AuthError message={error} />
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetInner />
    </Suspense>
  );
}
