'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Phone, Mail } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useRefreshProfile } from '@/hooks/use-auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AuthDivider, AuthError, AuthFooterLink, AuthShell } from '@/components/auth/AuthShell';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { cn } from '@/lib/cn';

type Method = 'phone' | 'email';

export default function LoginPage() {
  const router = useRouter();
  const refreshProfile = useRefreshProfile();
  const [method, setMethod] = useState<Method>('phone');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Phone flow
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);

  // Email flow
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSignedIn = async () => {
    await refreshProfile();
    router.replace('/account');
  };

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const requestOtp = () =>
    run(async () => {
      const res = await api.auth.otpRequest(phone);
      setDevCode(res.devCode ?? null);
      setOtpSent(true);
    });

  const verifyOtp = () =>
    run(async () => {
      await api.auth.otpVerify({ phone, code });
      await onSignedIn();
    });

  const loginEmail = () =>
    run(async () => {
      await api.auth.login({ email, password });
      await onSignedIn();
    });

  const googleLogin = (credential: string) =>
    run(async () => {
      await api.auth.google(credential);
      await onSignedIn();
    });

  return (
    <AuthShell
      titleBold="Welcome"
      titleItalic="back."
      subtitle="Sign in to track orders, save addresses and check out faster."
      footer={
        <>
          New to Wood House? <AuthFooterLink href="/signup">Create an account</AuthFooterLink>
        </>
      }
    >
      {/* Method tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-full bg-cream p-1" role="tablist" aria-label="Sign-in method">
        {(
          [
            { key: 'phone', label: 'Phone', Icon: Phone },
            { key: 'email', label: 'Email', Icon: Mail },
          ] as const
        ).map(({ key, label, Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={method === key}
            onClick={() => {
              setMethod(key);
              setError(null);
            }}
            className={cn(
              'inline-flex h-10 items-center justify-center gap-2 rounded-full font-inter text-sm font-semibold transition-colors',
              method === key ? 'bg-white text-navy-900 shadow-soft' : 'text-ink-muted hover:text-navy-900',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {method === 'phone' ? (
        !otpSent ? (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              requestOtp();
            }}
          >
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 font-inter text-[15px] text-ink-muted">
                +91
              </span>
              <Input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="pl-14"
                required
                pattern="[6-9][0-9]{9}"
                title="Enter a valid 10-digit Indian mobile number"
              />
            </div>
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              Send code
            </Button>
          </form>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              verifyOtp();
            }}
          >
            <p className="font-inter text-sm text-ink-muted">
              We sent a 6-digit code to <span className="font-semibold text-navy-900">+91 {phone}</span>{' '}
              <button
                type="button"
                className="text-brand-700 font-semibold hover:underline"
                onClick={() => {
                  setOtpSent(false);
                  setCode('');
                  setDevCode(null);
                }}
              >
                Change
              </button>
            </p>
            {devCode ? (
              <p className="rounded-2xl bg-sage-100 px-4 py-2.5 font-inter text-sm text-brand-800">
                Dev mode: your code is <strong data-testid="dev-otp">{devCode}</strong>
              </p>
            ) : null}
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center tracking-[0.5em] font-semibold"
              required
              pattern="[0-9]{6}"
            />
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              Verify &amp; sign in
            </Button>
            <button
              type="button"
              onClick={requestOtp}
              className="w-full text-center font-inter text-sm text-ink-muted hover:text-navy-900"
            >
              Didn&apos;t get it? Resend code
            </button>
          </form>
        )
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            loginEmail();
          }}
        >
          <Input
            type="email"
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <div className="text-right">
            <Link href="/account/forgot" className="font-inter text-sm text-ink-muted hover:text-navy-900">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Sign in
          </Button>
        </form>
      )}

      <AuthError message={error} />

      <AuthDivider />
      <GoogleSignInButton text="signin_with" onCredential={googleLogin} onError={setError} />
    </AuthShell>
  );
}
