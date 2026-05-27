'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
    // TODO: wire to /api/newsletter via TanStack Query mutation.
    setEmail('');
  }

  if (submitted) {
    return (
      <div className="rounded-2xl bg-cream/10 text-cream px-5 py-4 text-sm">
        Thanks! We’ve added you — check your inbox for the welcome code.
      </div>
    );
  }

  return (
    <form className="flex flex-col sm:flex-row gap-3" onSubmit={onSubmit}>
      <Input
        type="email"
        placeholder="you@example.com"
        className="bg-cream/95 text-ink"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit" variant="clay" size="lg" className="shrink-0">
        Subscribe
      </Button>
    </form>
  );
}
