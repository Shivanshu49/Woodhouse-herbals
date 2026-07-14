'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProductCard } from '@/components/product/ProductCard';
import { ShopFilters } from './ShopFilters';
import { ShopToolbar } from './ShopToolbar';
import { useCatalog } from '@/hooks/use-catalog';
import { parseShopQuery, filterAndSort } from '@/lib/shop-query';
import { Sparkles, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export function ShopGrid() {
  const sp = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { products, isLoading, isError } = useCatalog();
  const query = useMemo(() => parseShopQuery(sp), [sp]);
  const items = useMemo(() => filterAndSort(products, query), [products, query]);

  return (
    <div className="container-wide section">
      <div className="grid lg:grid-cols-[280px_1fr] gap-10">
        {/* Desktop filters */}
        <div className="hidden lg:block sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
          <ShopFilters />
        </div>

        <div>
          <ShopToolbar total={items.length} onOpenMobileFilters={() => setMobileOpen(true)} />
          {isError ? (
            // Honest failure — never fall back to bundled/phantom products.
            <div className="rounded-3xl bg-white border border-dashed border-navy-900/15 p-12 text-center shadow-soft">
              <AlertTriangle className="mx-auto h-9 w-9 text-brand-500" />
              <h3 className="mt-4 font-display text-2xl font-semibold text-navy-900">
                We couldn&apos;t load the shop
              </h3>
              <p className="mt-2 text-ink-muted">
                Something went wrong reaching our catalog. Please try again in a moment.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-500 text-white px-5 py-2.5 text-sm font-bold hover:bg-brand-600 transition-colors shadow-soft"
              >
                Retry
              </button>
            </div>
          ) : isLoading ? (
            <div
              className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5"
              aria-busy="true"
              aria-label="Loading products"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-3xl bg-white border border-navy-900/5 shadow-soft overflow-hidden"
                >
                  <div className="aspect-[4/5] w-full animate-pulse bg-navy-900/5" />
                  <div className="p-4 sm:p-5 space-y-3">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-navy-900/5" />
                    <div className="h-4 w-3/4 animate-pulse rounded bg-navy-900/5" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-navy-900/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-3xl bg-white border border-dashed border-navy-900/15 p-12 text-center shadow-soft">
              <Sparkles className="mx-auto h-9 w-9 text-brand-500" />
              <h3 className="mt-4 font-display text-2xl font-semibold text-navy-900">
                No products match those filters
              </h3>
              <p className="mt-2 text-ink-muted">
                Try removing a filter or browse our bestsellers instead.
              </p>
              <Link
                href="/shop"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-500 text-white px-5 py-2.5 text-sm font-bold hover:bg-brand-600 transition-colors shadow-soft"
              >
                Browse all products
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
              {items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filters drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true">
          <button
            aria-label="Close filters"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-[2rem] bg-cream p-6 shadow-lift animate-fade-up">
            <ShopFilters onClose={() => setMobileOpen(false)} showCloseButton />
            <button
              onClick={() => setMobileOpen(false)}
              className="mt-8 w-full rounded-full bg-brand-500 text-white px-6 py-3.5 text-sm font-bold hover:bg-brand-600 transition-colors"
            >
              Show {items.length} products
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
