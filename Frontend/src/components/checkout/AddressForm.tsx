'use client';

import { useState } from 'react';
import type { CheckoutAddress } from '@/types/order';

// Mirror the backend CreateOrderDto rules so we fail fast client-side; the
// server stays authoritative and will 400 anything that slips through.
const NAME_RE = /^[\p{L}\p{M}\s.'-]+$/u;
const ADDRESS_RE = /^[\p{L}\p{M}\p{N}\s,.'/\-#&()]+$/u;
const MOBILE_RE = /^[6-9]\d{9}$/;
const PINCODE_RE = /^[1-9]\d{5}$/;
const COUPON_RE = /^[a-z0-9_-]{3,40}$/i;

export function validateAddress(dto: CheckoutAddress): Partial<Record<keyof CheckoutAddress, string>> {
  const e: Partial<Record<keyof CheckoutAddress, string>> = {};
  const name = dto.fullName.trim();
  if (name.length < 2 || name.length > 80 || !NAME_RE.test(name)) e.fullName = 'Enter your full name.';
  if (!MOBILE_RE.test(dto.phone.trim())) e.phone = 'Enter a valid 10-digit Indian mobile number.';
  const l1 = dto.line1.trim();
  if (l1.length < 3 || l1.length > 160 || !ADDRESS_RE.test(l1)) e.line1 = 'Enter your address.';
  const l2 = (dto.line2 ?? '').trim();
  if (l2 && (l2.length > 160 || !ADDRESS_RE.test(l2))) e.line2 = 'Address line 2 has invalid characters.';
  const city = dto.city.trim();
  if (city.length < 2 || city.length > 80 || !NAME_RE.test(city)) e.city = 'Enter your city.';
  const state = dto.state.trim();
  if (state.length < 2 || state.length > 60 || !NAME_RE.test(state)) e.state = 'Enter your state.';
  if (!PINCODE_RE.test(dto.pincode.trim())) e.pincode = 'Enter a valid 6-digit pincode.';
  const coupon = (dto.couponCode ?? '').trim();
  if (coupon && !COUPON_RE.test(coupon)) e.couponCode = 'Invalid coupon code.';
  return e;
}

const FIELDS: { key: keyof CheckoutAddress; label: string; placeholder: string; half?: boolean }[] = [
  { key: 'fullName', label: 'Full name', placeholder: 'Priya Sharma' },
  { key: 'phone', label: 'Mobile number', placeholder: '9876543210' },
  { key: 'line1', label: 'Address line 1', placeholder: 'Flat / house no., street' },
  { key: 'line2', label: 'Address line 2 (optional)', placeholder: 'Area, landmark' },
  { key: 'city', label: 'City', placeholder: 'Mumbai', half: true },
  { key: 'state', label: 'State', placeholder: 'Maharashtra', half: true },
  { key: 'pincode', label: 'Pincode', placeholder: '400001', half: true },
];

export function AddressForm({
  defaults,
  disabled,
  submitLabel,
  onSubmit,
}: {
  defaults?: Partial<CheckoutAddress>;
  disabled?: boolean;
  submitLabel: string;
  onSubmit: (dto: CheckoutAddress) => void;
}) {
  const [values, setValues] = useState<CheckoutAddress>({
    fullName: defaults?.fullName ?? '',
    phone: defaults?.phone ?? '',
    line1: defaults?.line1 ?? '',
    line2: defaults?.line2 ?? '',
    city: defaults?.city ?? '',
    state: defaults?.state ?? '',
    pincode: defaults?.pincode ?? '',
    country: 'IN',
    couponCode: defaults?.couponCode ?? '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutAddress, string>>>({});

  const set = (key: keyof CheckoutAddress) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateAddress(values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    // Send only trimmed values; drop empty optionals so they're truly absent.
    const dto: CheckoutAddress = {
      fullName: values.fullName.trim(),
      phone: values.phone.trim(),
      line1: values.line1.trim(),
      city: values.city.trim(),
      state: values.state.trim(),
      pincode: values.pincode.trim(),
      country: 'IN',
    };
    const l2 = (values.line2 ?? '').trim();
    if (l2) dto.line2 = l2;
    const coupon = (values.couponCode ?? '').trim();
    if (coupon) dto.couponCode = coupon;
    onSubmit(dto);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid sm:grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.half ? '' : 'sm:col-span-2'}>
            <label htmlFor={f.key} className="block text-sm font-medium text-navy-900 mb-1">
              {f.label}
            </label>
            <input
              id={f.key}
              name={f.key}
              value={(values[f.key] as string) ?? ''}
              onChange={set(f.key)}
              placeholder={f.placeholder}
              disabled={disabled}
              aria-invalid={Boolean(errors[f.key])}
              aria-describedby={errors[f.key] ? `${f.key}-err` : undefined}
              className="w-full rounded-2xl border border-navy-900/15 bg-white px-4 py-3 text-sm text-navy-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
            />
            {errors[f.key] && (
              <p id={`${f.key}-err`} className="mt-1 text-xs text-blush-600">
                {errors[f.key]}
              </p>
            )}
          </div>
        ))}
        <div className="sm:col-span-2">
          <label htmlFor="couponCode" className="block text-sm font-medium text-navy-900 mb-1">
            Coupon code (optional)
          </label>
          <input
            id="couponCode"
            name="couponCode"
            value={values.couponCode ?? ''}
            onChange={set('couponCode')}
            placeholder="WH25"
            disabled={disabled}
            aria-invalid={Boolean(errors.couponCode)}
            className="w-full rounded-2xl border border-navy-900/15 bg-white px-4 py-3 text-sm uppercase text-navy-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
          />
          {errors.couponCode && <p className="mt-1 text-xs text-blush-600">{errors.couponCode}</p>}
          <p className="mt-1 text-xs text-ink-muted">Applied and confirmed on the next step — the final total is shown before you pay.</p>
        </div>
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-navy-900 text-cream h-12 px-6 text-sm font-bold hover:bg-navy-800 disabled:opacity-60"
      >
        {submitLabel}
      </button>
    </form>
  );
}
