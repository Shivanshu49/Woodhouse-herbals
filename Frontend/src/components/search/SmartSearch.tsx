'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Search, X, TrendingUp, ArrowRight, Tag, Leaf } from 'lucide-react';
import { productSummaries } from '@/data/products';
import { concerns } from '@/data/concerns';
import { useUiStore } from '@/store/ui';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/cn';

const TRENDING = ['Vit C serum', 'Hair fall oil', 'Anti-acne combo', 'D-Tan face wash', 'Niacinamide', 'Rice water'];

export function SmartSearch() {
  const open = useUiStore((s) => s.searchOpen);
  const setOpen = useUiStore((s) => s.setSearchOpen);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, setOpen]);

  const q = query.trim().toLowerCase();
  const productResults = useMemo(() => {
    if (!q) return productSummaries.slice(0, 4);
    return productSummaries
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.shortDescription.toLowerCase().includes(q) ||
          p.concerns.some((c) => c.includes(q)),
      )
      .slice(0, 6);
  }, [q]);

  const concernResults = useMemo(() => {
    if (!q) return concerns.slice(0, 4);
    return concerns.filter((c) => c.title.toLowerCase().includes(q) || c.slug.includes(q)).slice(0, 4);
  }, [q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Search">
      <button
        aria-label="Close search"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-up"
      />
      <div className="relative mx-auto mt-16 sm:mt-24 w-full max-w-3xl px-4 animate-fade-up">
        <div className="overflow-hidden rounded-3xl bg-cream shadow-lift border border-forest-900/10">
          <div className="flex items-center gap-3 border-b border-forest-900/10 px-4 sm:px-6 py-4">
            <Search className="h-5 w-5 text-forest-700 shrink-0" />
            <input
              ref={inputRef}
              type="search"
              autoComplete="off"
              placeholder="Search for products, concerns or ingredients…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-base sm:text-lg outline-none placeholder:text-ink-subtle"
            />
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-2 text-ink-muted hover:bg-forest-900/5 hover:text-forest-900"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-6 grid gap-6">
            {!q && (
              <section>
                <h3 className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
                  <TrendingUp className="h-3.5 w-3.5" /> Trending searches
                </h3>
                <div className="flex flex-wrap gap-2">
                  {TRENDING.map((t) => (
                    <button
                      key={t}
                      onClick={() => setQuery(t)}
                      className="rounded-full bg-white border border-forest-900/10 px-3 py-1.5 text-sm hover:border-forest-900/40"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {concernResults.length > 0 && (
              <section>
                <h3 className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
                  <Leaf className="h-3.5 w-3.5" /> Shop by concern
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {concernResults.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/shop?concern=${c.slug}`}
                      onClick={() => setOpen(false)}
                      className="group flex items-center justify-between rounded-2xl bg-white border border-forest-900/5 px-3 py-2.5 hover:border-forest-900/30 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-forest-900">{c.title}</p>
                        <p className="text-xs text-ink-muted">{c.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-ink-muted group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
                <Tag className="h-3.5 w-3.5" /> {q ? 'Matching products' : 'Popular right now'}
              </h3>
              {productResults.length === 0 ? (
                <div className="rounded-2xl bg-white border border-dashed border-forest-900/15 p-6 text-center">
                  <p className="text-sm text-ink-muted">No products match “{query}”.</p>
                  <Link
                    href="/shop"
                    onClick={() => setOpen(false)}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-forest-900 hover:text-forest-700"
                  >
                    Browse all products <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <ul className="grid gap-2">
                  {productResults.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/shop/${p.slug}`}
                        onClick={() => setOpen(false)}
                        className={cn(
                          'group flex items-center gap-3 rounded-2xl bg-white border border-forest-900/5 p-2 hover:border-forest-900/30',
                          'transition-colors',
                        )}
                      >
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-sand-100">
                          <Image src={p.thumbnail.url} alt={p.thumbnail.alt} fill sizes="56px" className="object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-forest-900">{p.name}</p>
                          <p className="truncate text-xs text-ink-muted">{p.shortDescription}</p>
                        </div>
                        <span className="text-sm font-semibold text-forest-900 shrink-0">{formatPrice(p.price)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
