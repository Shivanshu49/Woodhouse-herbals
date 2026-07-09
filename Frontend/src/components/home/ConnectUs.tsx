'use client';

import { useRef, useState } from 'react';
import { Mail, Paperclip, Phone, Send, X } from 'lucide-react';

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT = /^(image\/(jpeg|png|webp|gif|heic|heif)|application\/pdf)$/;

const inputClass =
  'w-full rounded-xl border border-navy-900/10 bg-white px-4 py-2.5 text-sm text-navy-900 placeholder:text-ink-subtle focus:border-brand-500 transition-colors';

type Status = 'idle' | 'submitting' | 'sent' | 'error';

/**
 * "Connect With Us" — compact contact form (name/phone/email/message + one
 * image/PDF attachment, 5MB client-validated) posting to /api/connect, with
 * the store's phone/email beside it. Sits just above the newsletter/footer.
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
      setErrors((e) => ({ ...e, attachment: 'Attachment must be 5MB or smaller.' }));
      setFileName(null);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (!ALLOWED_ATTACHMENT.test(file.type)) {
      setErrors((e) => ({ ...e, attachment: 'Attach an image or a PDF.' }));
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
        setServerError(body.errors ? null : body.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
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
                Questions about a product, an order, or your routine? Write to us — attach a photo or
                prescription if it helps — and we'll get back within 24 hours.
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

            <form ref={formRef} onSubmit={onSubmit} className="lg:col-span-7" noValidate>
              {/* Honeypot — hidden from people, filled by bots */}
              <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="connect-name" className="block text-xs font-bold text-navy-900 uppercase tracking-wide mb-1.5">Name</label>
                  <input id="connect-name" name="name" required maxLength={120} autoComplete="name" placeholder="Your name" className={inputClass} />
                  {errors.name && <p className="mt-1 text-xs text-blush-600">{errors.name}</p>}
                </div>
                <div>
                  <label htmlFor="connect-phone" className="block text-xs font-bold text-navy-900 uppercase tracking-wide mb-1.5">Phone</label>
                  <input id="connect-phone" name="phone" required type="tel" autoComplete="tel" placeholder="+91 98XXXXXXXX" className={inputClass} />
                  {errors.phone && <p className="mt-1 text-xs text-blush-600">{errors.phone}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="connect-email" className="block text-xs font-bold text-navy-900 uppercase tracking-wide mb-1.5">Email</label>
                  <input id="connect-email" name="email" required type="email" autoComplete="email" placeholder="you@example.com" className={inputClass} />
                  {errors.email && <p className="mt-1 text-xs text-blush-600">{errors.email}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="connect-message" className="block text-xs font-bold text-navy-900 uppercase tracking-wide mb-1.5">Message</label>
                  <textarea id="connect-message" name="message" required rows={4} maxLength={5000} placeholder="How can we help?" className={`${inputClass} resize-y min-h-[96px]`} />
                  {errors.message && <p className="mt-1 text-xs text-blush-600">{errors.message}</p>}
                </div>
                <div className="sm:col-span-2">
                  <input
                    ref={fileRef}
                    id="connect-attachment"
                    name="attachment"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={onFileChange}
                    className="sr-only"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <label
                      htmlFor="connect-attachment"
                      className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-navy-900/10 bg-white px-4 py-2 text-[13px] font-semibold text-navy-900 hover:border-brand-500 hover:text-brand-700 transition-colors"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {fileName ? 'Change attachment' : 'Attach image or PDF'}
                    </label>
                    {fileName && (
                      <span className="inline-flex items-center gap-2 text-[13px] text-ink-muted">
                        <span className="max-w-[220px] truncate">{fileName}</span>
                        <button type="button" onClick={clearFile} aria-label="Remove attachment" className="text-ink-subtle hover:text-blush-600">
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    )}
                    <span className="text-[12px] text-ink-subtle">Optional · max 5MB</span>
                  </div>
                  {errors.attachment && <p className="mt-1 text-xs text-blush-600">{errors.attachment}</p>}
                </div>
              </div>

              <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="btn-primary h-12 px-7 text-sm w-full sm:w-auto disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {status === 'submitting' ? 'Sending…' : 'Send message'}
                </button>
                <p role="status" aria-live="polite" className="text-sm">
                  {status === 'sent' && <span className="font-semibold text-brand-700">Message sent — we'll get back within 24 hours.</span>}
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
