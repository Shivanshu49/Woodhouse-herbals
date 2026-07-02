'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { AuthShell } from '@/components/auth/AuthShell';

function VerifyInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token');
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');
  const [message, setMessage] = useState('');
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return; // React StrictMode double-invokes effects in dev
    fired.current = true;
    if (!token) {
      setState('failed');
      setMessage('This verification link is missing its token.');
      return;
    }
    api.auth
      .verifyEmail(token)
      .then(() => setState('done'))
      .catch((err) => {
        setState('failed');
        setMessage(
          err instanceof ApiError ? err.message : 'Verification failed. Please try again.',
        );
      });
  }, [token]);

  return (
    <AuthShell titleBold="Email" titleItalic="verification.">
      <div className="text-center py-4">
        {state === 'working' ? (
          <p className="font-inter text-[15px] text-ink-muted">Verifying your email…</p>
        ) : state === 'done' ? (
          <>
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-sage-100 text-brand-700">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <p className="mt-4 font-inter text-[15px] text-ink-muted">
              Your email is verified. You can sign in now.
            </p>
            <Button className="mt-6 w-full" size="lg" onClick={() => router.push('/login')}>
              Sign in
            </Button>
          </>
        ) : (
          <>
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-blush-100 text-blush-600">
              <XCircle className="h-7 w-7" />
            </span>
            <p className="mt-4 font-inter text-[15px] text-ink-muted">{message}</p>
            <Button className="mt-6 w-full" size="lg" variant="secondary" onClick={() => router.push('/login')}>
              Back to sign in
            </Button>
          </>
        )}
      </div>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
