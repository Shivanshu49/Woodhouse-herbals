import { Star, BadgeCheck } from 'lucide-react';
import { Rating } from '@/components/ui/Rating';
import { reviewsByProduct } from '@/data/reviews';
import type { Product } from '@/types';

export function ProductReviews({ product }: { product: Product }) {
  const reviews = reviewsByProduct[product.id] ?? [];
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    pct: Math.round(((Math.random() * 0.4 + (star === 5 ? 0.55 : star === 4 ? 0.2 : 0.1)) * 100)),
  }));

  return (
    <section className="mt-16">
      <div className="grid lg:grid-cols-3 gap-8 mb-10">
        <div className="lg:col-span-1 rounded-3xl bg-white border border-forest-900/5 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-wider text-ink-muted">Customer rating</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-5xl text-forest-900">{product.rating.toFixed(1)}</span>
            <span className="text-ink-muted">/ 5</span>
          </div>
          <Rating value={product.rating} reviewCount={product.reviewCount} className="mt-2" />
          <div className="mt-5 space-y-2">
            {distribution.map((row) => (
              <div key={row.star} className="flex items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1 w-10 text-ink-muted">
                  <Star className="h-3 w-3 fill-clay-300 text-clay-300" />
                  {row.star}
                </span>
                <span className="flex-1 h-2 rounded-full bg-sand-200 overflow-hidden">
                  <span
                    className="block h-full bg-forest-900"
                    style={{ width: `${Math.min(95, row.pct)}%` }}
                  />
                </span>
                <span className="w-8 text-right text-xs text-ink-muted">{Math.min(95, row.pct)}%</span>
              </div>
            ))}
          </div>
          <button className="mt-6 w-full rounded-full bg-forest-900 text-cream py-2.5 text-sm font-medium hover:bg-forest-800">
            Write a review
          </button>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {reviews.length === 0 ? (
            <div className="rounded-3xl bg-white border border-dashed border-forest-900/15 p-8 text-center">
              <p className="text-ink-muted">No reviews yet. Be the first to share your experience.</p>
            </div>
          ) : (
            reviews.map((r) => (
              <article key={r.id} className="rounded-3xl bg-white border border-forest-900/5 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sage-200 text-forest-900 font-medium">
                      {r.authorName.charAt(0)}
                    </span>
                    <div>
                      <p className="font-medium text-forest-900">{r.authorName}</p>
                      <p className="text-xs text-ink-muted">{new Date(r.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
                    </div>
                  </div>
                  {r.verifiedPurchase && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-forest-700">
                      <BadgeCheck className="h-3.5 w-3.5" /> Verified
                    </span>
                  )}
                </div>
                <Rating value={r.rating} showCount={false} className="mt-3" />
                <h4 className="mt-2 font-display text-lg text-forest-900">{r.title}</h4>
                <p className="mt-1 text-ink leading-relaxed">{r.body}</p>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
