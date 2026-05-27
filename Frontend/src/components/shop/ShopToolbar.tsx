'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';

interface Props {
  total: number;
  onOpenMobileFilters: () => void;
}

const SORTS = [
  { value: '', label: 'Most popular' },
  { value: 'bestsellers', label: 'Bestsellers' },
  { value: 'new', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
];

export function ShopToolbar({ total, onOpenMobileFilters }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const sort = sp.get('sort') ?? '';

  function setSort(value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set('sort', value);
    else next.delete('sort');
    router.push(`/shop?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center justify-between gap-3 mb-6">
      <p className="text-sm text-ink-muted">
        <span className="font-medium text-forest-900">{total}</span> product{total === 1 ? '' : 's'}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenMobileFilters}
          className="lg:hidden inline-flex items-center gap-2 rounded-full border border-forest-900/15 bg-white px-3.5 py-2 text-sm"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </button>
        <label className="inline-flex items-center gap-2 rounded-full border border-forest-900/15 bg-white px-4 py-2 text-sm">
          <span className="text-ink-muted">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-transparent text-forest-900 focus:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
