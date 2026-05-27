'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProductCard } from '@/components/product/ProductCard';
import { ShopFilters } from './ShopFilters';
import { ShopToolbar } from './ShopToolbar';
import { productSummaries } from '@/data/products';
import { parseShopQuery, filterAndSort } from '@/lib/shop-query';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';

export function ShopGrid() {
  const sp = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const query = useMemo(() => parseShopQuery(sp), [sp]);
  const items = useMemo(() => filterAndSort(productSummaries, query), [query]);

  return (
    <div className="container-wide section">
      <div className="grid lg:grid-cols-[280px_1fr] gap-10">
        {/* Desktop filters */}
        <div className="hidden lg:block sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
          <ShopFilters />
        </div>

        <div>
          <ShopToolbar total={items.length} onOpenMobileFilters={() => setMobileOpen(true)} />
          {items.length === 0 ? (
            <div className="rounded-3xl bg-white border border-dashed border-forest-900/15 p-12 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-clay-300" />
              <h3 className="mt-4 font-display text-xl text-forest-900">No products match those filters</h3>
              <p className="mt-2 text-ink-muted">Try removing a filter or browse our bestsellers instead.</p>
              <Link
                href="/shop"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-forest-900 text-cream px-5 py-2.5 text-sm"
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
              className="mt-8 w-full rounded-full bg-forest-900 px-6 py-3 text-sm font-medium text-cream"
            >
              Show {items.length} products
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
