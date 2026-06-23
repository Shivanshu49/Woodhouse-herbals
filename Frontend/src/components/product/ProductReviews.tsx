import { Star, BadgeCheck } from 'lucide-react';
import { Rating } from '@/components/ui/Rating';
import { reviewsByProduct } from '@/data/reviews';
import type { Product } from '@/types';

// Deterministic fallback shape (sums to 100), skewed toward 5★, used only when
// there are no granular review rows to count. Kept out of render so the value
// is stable between server and client — using Math.random() here previously
// caused a hydration mismatch and a different bar chart on every render.
const FALLBACK_DISTRIBUTION: Record<number, number> = { 5: 68, 4: 20, 3: 7, 2: 3, 1: 2 };

export function ProductReviews({ product }: { product: Product }) {
  const reviews = reviewsByProduct[product.id] ?? [];
  const totalRated = reviews.length;
  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => r.rating === star).length;
    return {
      star,
      pct: totalRated ? Math.round((count / totalRated) * 100) : FALLBACK_DISTRIBUTION[star],
    };
  });

  return (
    <section className="mt-16">
      <div className="grid lg:grid-cols-3 gap-8 mb-10">
        <div className="lg:col-span-1 rounded-3xl bg-white border border-navy-900/5 shadow-soft p-6 sm:p-8">
          <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-muted">Customer rating</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-5xl font-bold text-navy-900">{product.rating.toFixed(1)}</span>
            <span className="text-ink-muted">/ 5</span>
          </div>
          <Rating value={product.rating} reviewCount={product.reviewCount} className="mt-2" />
          <div className="mt-5 space-y-2">
            {distribution.map((row) => (
              <div key={row.star} className="flex items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1 w-10 text-ink-muted">
                  <Star className="h-3 w-3 fill-citrus text-citrus" />
                  {row.star}
                </span>
                <span className="flex-1 h-2 rounded-full bg-navy-900/8 overflow-hidden">
                  <span
                    className="block h-full bg-brand-500"
                    style={{ width: `${Math.min(95, row.pct)}%` }}
                  />
                </span>
                <span className="w-8 text-right text-xs text-ink-muted">{Math.min(95, row.pct)}%</span>
              </div>
            ))}
          </div>
          <button className="mt-6 w-full rounded-full bg-navy-900 text-cream py-3 text-sm font-bold hover:bg-navy-800 shadow-soft">
            Write a review
          </button>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {reviews.length === 0 ? (
            <div className="rounded-3xl bg-white border border-dashed border-navy-900/15 p-8 text-center shadow-soft">
              <p className="text-ink-muted">No reviews yet. Be the first to share your experience.</p>
            </div>
          ) : (
            reviews.map((r) => (
              <article key={r.id} className="rounded-3xl bg-white border border-navy-900/5 shadow-soft p-6 hover:shadow-lift transition-shadow">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/15 text-brand-700 font-bold">
                      {r.authorName.charAt(0)}
                    </span>
                    <div>
                      <p className="font-bold text-navy-900">{r.authorName}</p>
                      <p className="text-xs text-ink-muted">{new Date(r.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
                    </div>
                  </div>
                  {r.verifiedPurchase && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 uppercase tracking-wider">
                      <BadgeCheck className="h-3.5 w-3.5" /> Verified
                    </span>
                  )}
                </div>
                <Rating value={r.rating} showCount={false} className="mt-3" />
                <h4 className="mt-2 font-display text-lg font-semibold text-navy-900">{r.title}</h4>
                <p className="mt-1 text-navy-900/85 leading-relaxed">{r.body}</p>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
