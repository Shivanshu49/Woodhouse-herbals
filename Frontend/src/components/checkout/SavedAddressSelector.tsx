'use client';

import Link from 'next/link';
import { AlertTriangle, Loader2, MapPin, PencilLine, Star } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { CustomerAddress } from '@/types/auth';

export type SavedAddressStatus = 'loading' | 'signed-out' | 'error' | 'empty' | 'ready';

export function SavedAddressSelector({
  status,
  addresses,
  selected,
  onSelect,
  onUseDifferent,
  onManualIntent,
  onRetry,
}: {
  status: SavedAddressStatus;
  addresses: CustomerAddress[];
  selected: string | 'manual';
  onSelect: (address: CustomerAddress) => void;
  onUseDifferent: () => void;
  onManualIntent: () => void;
  onRetry: () => void;
}) {
  return (
    <section aria-labelledby="saved-addresses-heading" className="rounded-3xl border border-navy-900/8 bg-cream/55 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 id="saved-addresses-heading" className="font-display text-lg font-semibold text-navy-900">
            Saved addresses
          </h3>
          <p className="mt-1 text-sm text-ink-muted">Choose one from your address book or enter another below.</p>
        </div>
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
      </div>

      <fieldset className="mt-5">
        <legend className="sr-only">Choose a shipping address</legend>

        {status === 'loading' ? (
          <div className="flex items-center gap-3 rounded-2xl border border-navy-900/8 bg-white px-4 py-5 text-sm text-ink-muted" role="status">
            <Loader2 className="h-4 w-4 animate-spin text-brand-600" aria-hidden="true" />
            Loading your saved addresses… You can enter a different address below.
          </div>
        ) : null}

        {status === 'signed-out' ? (
          <div className="rounded-2xl border border-navy-900/8 bg-white px-4 py-4 text-sm text-ink-muted">
            <Link href="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link>{' '}
            to use your saved addresses, or continue with a different address.
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="rounded-2xl border border-blush/30 bg-blush-100/45 px-4 py-4" role="alert">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-blush-600" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-navy-900">We couldn’t load your saved addresses.</p>
                <p className="mt-0.5 text-xs text-ink-muted">You can retry or enter a different address below.</p>
              </div>
            </div>
            <button type="button" onClick={onRetry} className="mt-3 text-sm font-semibold text-brand-700 hover:underline">
              Try again
            </button>
          </div>
        ) : null}

        {status === 'empty' ? (
          <div className="rounded-2xl border border-dashed border-navy-900/15 bg-white/70 px-4 py-5 text-sm text-ink-muted">
            You don’t have any saved addresses yet. Enter your shipping address below.
          </div>
        ) : null}

        {status === 'ready' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {addresses.map((address) => {
              const isSelected = selected === address.id;
              return (
                <label
                  key={address.id}
                  className={cn(
                    'relative cursor-pointer rounded-2xl border bg-white p-4 transition-all duration-200',
                    'hover:-translate-y-0.5 hover:border-brand-500/50 hover:shadow-soft',
                    'focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-500/30',
                    isSelected
                      ? 'border-brand-600 ring-2 ring-brand-500/15 shadow-soft'
                      : 'border-navy-900/10',
                  )}
                >
                  <input
                    type="radio"
                    name="saved-address"
                    value={address.id}
                    checked={isSelected}
                    onChange={() => onSelect(address)}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      'absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2',
                      isSelected ? 'border-brand-600' : 'border-navy-900/25',
                    )}
                    aria-hidden="true"
                  >
                    {isSelected ? <span className="h-2.5 w-2.5 rounded-full bg-brand-600" /> : null}
                  </span>
                  <div className="pr-8">
                    <p className="font-semibold text-navy-900">{address.fullName}</p>
                    {address.isDefault ? (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-sage-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-800">
                        <Star className="h-2.5 w-2.5 fill-current" aria-hidden="true" /> Default
                      </span>
                    ) : null}
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                      {address.line1}{address.line2 ? `, ${address.line2}` : ''}<br />
                      {address.city}, {address.state} – {address.pincode}<br />
                      +91 {address.phone.replace(/^\+91/, '')}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        ) : null}

        <label
          className={cn(
            'mt-3 flex cursor-pointer items-center gap-3 rounded-2xl border bg-white px-4 py-3.5 transition-colors',
            'focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-500/30',
            selected === 'manual'
              ? 'border-brand-600 ring-2 ring-brand-500/15'
              : 'border-navy-900/10 hover:border-brand-500/50',
          )}
        >
          <input
            type="radio"
            name="saved-address"
            value="manual"
            checked={selected === 'manual'}
            onChange={onUseDifferent}
            onClick={() => {
              // Clicking an already-selected manual option during loading still
              // records the customer's intent before saved addresses arrive.
              if (selected === 'manual') onManualIntent();
            }}
            className="h-4 w-4 accent-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          />
          <PencilLine className="h-4 w-4 text-brand-600" aria-hidden="true" />
          <span className="text-sm font-semibold text-navy-900">Use a different address</span>
        </label>
      </fieldset>
    </section>
  );
}
