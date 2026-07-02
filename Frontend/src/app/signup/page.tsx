'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useRefreshProfile } from '@/hooks/use-auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AuthDivider, AuthError, AuthFooterLink, AuthShell } from '@/components/auth/AuthShell';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { MailCheck } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const refreshProfile = useRefreshProfile();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);

  const onSignedIn = async () => {
    await refreshProfile();
    router.replace('/account');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.auth.register({ fullName, email, password });
      // Try to sign straight in. In production the account needs email
      // verification first (login 403s and we show the "check your inbox"
      // state); in dev the backend auto-verifies and this succeeds.
      try {
        await api.auth.login({ email, password });
        await onSignedIn();
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          setNeedsVerification(true);
        } else {
          throw err;
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const googleSignup = async (credential: string) => {
    setError(null);
    setBusy(true);
    try {
      await api.auth.google(credential);
      await onSignedIn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (needsVerification) {
    return (
      <AuthShell titleBold="Check your" titleItalic="inbox.">
        <div className="text-center py-4">
          <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-sage-100 text-brand-700">
            <MailCheck className="h-7 w-7" />
          </span>
          <p className="mt-4 font-inter text-[15px] text-ink-muted leading-relaxed">
            We sent a verification link to <span className="font-semibold text-navy-900">{email}</span>.
            Click it, then sign in.
          </p>
          <Button className="mt-6 w-full" size="lg" onClick={() => router.push('/login')}>
            Go to sign in
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      titleBold="Create"
      titleItalic="account."
      subtitle="Join the ritual — faster checkout, order tracking and member offers."
      footer={
        <>
          Already have an account? <AuthFooterLink href="/login">Sign in</AuthFooterLink>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit}>
        <Input
          type="text"
          autoComplete="name"
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          minLength={2}
          maxLength={80}
        />
        <Input
          type="email"
          autoComplete="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Password"
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
          Create account
        </Button>
      </form>

      <AuthError message={error} />

      <AuthDivider />
      <GoogleSignInButton text="signup_with" onCredential={googleSignup} onError={setError} />

      <p className="mt-6 text-center font-inter text-xs text-ink-subtle">
        Prefer OTP? <AuthFooterLink href="/login">Sign in with your phone number</AuthFooterLink> — an
        account is created automatically.
      </p>
    </AuthShell>
  );
}
