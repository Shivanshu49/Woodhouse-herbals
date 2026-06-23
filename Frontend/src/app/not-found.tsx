import Link from 'next/link';
import { Sprout, ArrowRight } from 'lucide-react';

export default function NotFound() {
  return (
    <section className="container-wide py-24 text-center">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/15 text-brand-700">
        <Sprout className="h-7 w-7" />
      </span>
      <h1 className="mt-6 text-display-lg text-balance">We couldn't find that page.</h1>
      <p className="mt-3 text-ink-muted max-w-md mx-auto leading-relaxed">
        The page you're looking for may have moved or no longer exists. Let's get you back to the herbs.
      </p>
      <div className="mt-7 flex items-center justify-center gap-3 flex-wrap">
        <Link
          href="/"
          className="btn-primary h-12 px-6 text-sm"
        >
          Back to home <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/shop"
          className="btn-ghost h-12 px-6 text-sm"
        >
          Browse the shop
        </Link>
      </div>
    </section>
  );
}
