import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * Shared centered-card layout for /login, /signup and the small
 * verify/forgot/reset pages. Heading follows the site's Fraunces
 * bold + italic pattern (see BestSellerCarousel).
 */
export function AuthShell({
  titleBold,
  titleItalic,
  subtitle,
  children,
  footer,
}: {
  titleBold: string;
  titleItalic?: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-[70vh] bg-brand-cream/60 py-14 sm:py-20">
      <div className="mx-auto w-full max-w-md px-4">
        <h1 className="font-display text-4xl sm:text-5xl text-brand-forest leading-none text-center">
          <span className="font-bold not-italic">{titleBold}</span>
          {titleItalic ? <span className="font-normal italic"> {titleItalic}</span> : null}
        </h1>
        {subtitle ? (
          <p className="mt-3 text-center font-inter text-[15px] text-brand-forest/70">{subtitle}</p>
        ) : null}

        <div className="mt-8 rounded-3xl bg-white p-6 sm:p-8 shadow-soft border border-navy-900/5">
          {children}
        </div>

        {footer ? (
          <p className="mt-6 text-center font-inter text-sm text-brand-forest/70">{footer}</p>
        ) : null}
      </div>
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="my-6 flex items-center gap-4" aria-hidden="true">
      <span className="h-px flex-1 bg-navy-900/10" />
      <span className="font-inter text-xs uppercase tracking-widest text-ink-subtle">or</span>
      <span className="h-px flex-1 bg-navy-900/10" />
    </div>
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      data-testid="auth-error"
      className="mt-3 rounded-2xl bg-blush-100 px-4 py-2.5 font-inter text-sm text-blush-600"
    >
      {message}
    </p>
  );
}

export function AuthFooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-brand-700 hover:text-brand-600 underline underline-offset-4 decoration-brand-500/40">
      {children}
    </Link>
  );
}
