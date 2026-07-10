'use client';

import { useRef, useState } from 'react';
import { Mail, Paperclip, Phone, Send, X } from 'lucide-react';
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_SIZE_ERROR,
  ATTACHMENT_TYPE_ERROR,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_LABEL,
  attachmentLooksAllowed,
} from '@/lib/connect';

// Submit-error focus order mirrors the visual field order.
const FIELD_ORDER = ['name', 'phone', 'email', 'message', 'attachment'] as const;

const inputClass =
  'w-full rounded-xl border border-navy-900/10 bg-white px-4 py-2.5 text-sm text-navy-900 placeholder:text-ink-subtle focus:border-brand-500 transition-colors';

type Status = 'idle' | 'submitting' | 'sent' | 'error';

/**
 * "Connect With Us" — compact contact form (name/phone/email/message + one
 * image/PDF attachment, client-validated against the shared @/lib/connect
 * rules) posting to /api/connect, with the store's phone/email beside it.
 * Sits just above the newsletter/footer.
 */
export function ConnectUs() {
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function onFileChange() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setFileName(null);
      setErrors((e) => ({ ...e, attachment: '' }));
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setErrors((e) => ({ ...e, attachment: ATTACHMENT_SIZE_ERROR }));
      setFileName(null);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (!attachmentLooksAllowed(file)) {
      setErrors((e) => ({ ...e, attachment: ATTACHMENT_TYPE_ERROR }));
      setFileName(null);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setErrors((e) => ({ ...e, attachment: '' }));
    setFileName(file.name);
  }

  function clearFile() {
    if (fileRef.current) fileRef.current.value = '';
    setFileName(null);
    setErrors((e) => ({ ...e, attachment: '' }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    setServerError(null);
    try {
      const res = await fetch('/api/connect', { method: 'POST', body: new FormData(e.currentTarget) });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        setStatus('sent');
        setErrors({});
        formRef.current?.reset();
        setFileName(null);
      } else {
        setStatus('error');
        setErrors(body.errors ?? {});
        // Field errors also get a live-region summary + focus on the first
        // invalid field — the per-field messages alone are silent to screen
        // readers and invisible to anyone scrolled past them.
        if (body.errors) {
          setServerError('Please fix the highlighted fields below.');
          const first = FIELD_ORDER.find((f) => body.errors[f]);
          if (first) document.getElementById(`connect-${first}`)?.focus();
        } else {
          setServerError(body.error ?? 'Something went wrong. Please try again.');
        }
      }
    } catch {
      setStatus('error');
      setErrors({});
      setServerError('Something went wrong. Please check your connection and try again.');
    }
  }

  return (
    <section aria-label="Connect with us" className="py-10 sm:py-16">
      <div className="container-wide">
        <div className="rounded-[2.5rem] bg-white border border-navy-900/5 shadow-soft px-5 py-8 sm:px-10 sm:py-12">
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-5">
              <span className="eyebrow">We're listening</span>
              <h2 className="mt-4 text-display-lg text-balance">Connect With Us</h2>
              <p className="mt-3 text-ink-muted leading-relaxed max-w-md">
                Questions about a product, an order, or your routine? Write to us and we'll get
                back within 24 hours. Attach a photo or prescription if it helps.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                <li>
                  <a href="tel:+919819488857" className="inline-flex items-center gap-3 text-navy-900 hover:text-brand-700 font-semibold">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/12 text-brand-700">
                      <Phone className="h-4 w-4" />
                    </span>
                    +91 98194 88857
                  </a>
                </li>
                <li>
                  <a href="mailto:info@woodhouseherbals.com" className="inline-flex items-center gap-3 text-navy-900 hover:text-brand-700 font-semibold">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/12 text-brand-700">
                      <Mail className="h-4 w-4" />
                    </span>
                    info@woodhouseherbals.com
                  </a>
                </li>
              </ul>
            </div>

            <form
              ref={formRef}
              onSubmit={onSubmit}
              onInput={() => {
                // A fresh draft shouldn't sit next to a stale "Message sent" line.
                if (status === 'sent') setStatus('idle');
              }}
              className="lg:col-span-7"
              noValidate
            >
              {/* Honeypot — hidden from people, filled by bots. Meaningless name
                  on purpose: real tokens like "company" get browser-autofilled,
                  which makes genuine submissions look like bots. */}
              <input type="text" name="_gotcha" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

              <p className="mb-3 text-sm font-semibold text-navy-900">Please fill up your details</p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="connect-name" className="block text-xs font-bold text-navy-900 uppercase tracking-wide mb-1.5">Name</label>
                  <input id="connect-name" name="name" required maxLength={120} autoComplete="name" placeholder="Your name" className={inputClass} aria-invalid={!!errors.name || undefined} aria-describedby={errors.name ? 'connect-name-error' : undefined} />
                  {errors.name && <p id="connect-name-error" className="mt-1 text-xs text-blush-600">{errors.name}</p>}
                </div>
                <div>
                  <label htmlFor="connect-phone" className="block text-xs font-bold text-navy-900 uppercase tracking-wide mb-1.5">Phone</label>
                  <input id="connect-phone" name="phone" required type="tel" autoComplete="tel" placeholder="+91 98XXXXXXXX" className={inputClass} aria-invalid={!!errors.phone || undefined} aria-describedby={errors.phone ? 'connect-phone-error' : undefined} />
                  {errors.phone && <p id="connect-phone-error" className="mt-1 text-xs text-blush-600">{errors.phone}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="connect-email" className="block text-xs font-bold text-navy-900 uppercase tracking-wide mb-1.5">Email</label>
                  <input id="connect-email" name="email" required type="email" autoComplete="email" placeholder="you@example.com" className={inputClass} aria-invalid={!!errors.email || undefined} aria-describedby={errors.email ? 'connect-email-error' : undefined} />
                  {errors.email && <p id="connect-email-error" className="mt-1 text-xs text-blush-600">{errors.email}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="connect-message" className="block text-xs font-bold text-navy-900 uppercase tracking-wide mb-1.5">Message</label>
                  <textarea id="connect-message" name="message" required rows={4} maxLength={5000} placeholder="How can we help?" className={`${inputClass} resize-y min-h-[96px]`} aria-invalid={!!errors.message || undefined} aria-describedby={errors.message ? 'connect-message-error' : undefined} />
                  {errors.message && <p id="connect-message-error" className="mt-1 text-xs text-blush-600">{errors.message}</p>}
                </div>
                <div className="sm:col-span-2">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* The sr-only input lives INSIDE the label so focus-within can
                        paint a visible ring on the pill — the input's own focus ring
                        is clipped to 1px with it. */}
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-navy-900/10 bg-white px-4 py-2 text-[13px] font-semibold text-navy-900 hover:border-brand-500 hover:text-brand-700 transition-colors focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2">
                      <input
                        ref={fileRef}
                        id="connect-attachment"
                        name="attachment"
                        type="file"
                        accept={ATTACHMENT_ACCEPT}
                        onChange={onFileChange}
                        className="sr-only"
                        aria-invalid={!!errors.attachment || undefined}
                        aria-describedby={errors.attachment ? 'connect-attachment-error' : undefined}
                      />
                      <Paperclip className="h-3.5 w-3.5" />
                      {fileName ? 'Change attachment' : 'Attach image or PDF'}
                    </label>
                    {fileName && (
                      <span className="inline-flex items-center gap-2 text-[13px] text-ink-muted">
                        <span className="max-w-[220px] truncate">{fileName}</span>
                        <button type="button" onClick={clearFile} aria-label="Remove attachment" className="p-3 -m-2 text-ink-subtle hover:text-blush-600">
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    )}
                    <span className="text-[12px] text-ink-subtle">Optional · max {MAX_ATTACHMENT_LABEL}</span>
                  </div>
                  {/* Picker rejections happen without a submit round-trip, so this
                      one is its own live region. */}
                  {errors.attachment && <p id="connect-attachment-error" role="alert" className="mt-1 text-xs text-blush-600">{errors.attachment}</p>}
                </div>
              </div>

              <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
                {/* aria-disabled (not disabled) — disabling the focused button drops
                    keyboard focus to <body>; onSubmit already guards re-entry. */}
                <button
                  type="submit"
                  aria-disabled={status === 'submitting'}
                  className="btn-primary h-12 px-7 text-sm w-full sm:w-auto aria-disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {status === 'submitting' ? 'Sending…' : 'Send message'}
                </button>
                <p role="status" aria-live="polite" className="text-sm">
                  {status === 'sent' && <span className="font-semibold text-brand-700">Message sent. We'll get back within 24 hours.</span>}
                  {status === 'error' && serverError && <span className="font-semibold text-blush-600">{serverError}</span>}
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
