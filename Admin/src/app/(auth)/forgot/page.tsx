'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({ email: z.string().email('Enter a valid email address') });
type FormValues = z.infer<typeof schema>;

export default function ForgotPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    // The backend answers identically whether or not the email exists, so we
    // always show the same confirmation (no account enumeration).
    try {
      await api.auth.forgotPassword(values.email);
    } catch {
      /* ignore — same confirmation regardless */
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="font-display text-2xl font-semibold">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          If that address has an admin account, a password reset link is on its way.
        </p>
        <Link href="/login" className="inline-block text-sm text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="font-display text-2xl font-semibold">Reset your password</h1>
        <p className="text-sm text-muted-foreground">We'll email you a reset link.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" autoFocus {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </Button>
        <Link href="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
