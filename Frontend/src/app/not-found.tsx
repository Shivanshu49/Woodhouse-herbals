import Link from 'next/link';
import { Sprout, ArrowRight } from 'lucide-react';

export default function NotFound() {
  return (
    <section className="container-wide py-24 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-sage-200 text-forest-900">
        <Sprout className="h-6 w-6" />
      </span>
      <h1 className="mt-6 text-display-lg text-balance">We couldn’t find that page.</h1>
      <p className="mt-3 text-ink-muted max-w-md mx-auto">
        The page you’re looking for may have moved or no longer exists. Let’s get you back to the herbs.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-forest-900 text-cream px-6 py-3 text-sm font-medium hover:bg-forest-800"
        >
          Back to home <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 rounded-full bg-white border border-forest-900/15 px-6 py-3 text-sm font-medium hover:bg-forest-900/5"
        >
          Browse the shop
        </Link>
      </div>
    </section>
  );
}
