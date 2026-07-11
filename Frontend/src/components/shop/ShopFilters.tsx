'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import { cn } from '@/lib/cn';

const CATEGORIES = [
  { value: 'face-wash', label: 'Face Wash' },
  { value: 'serum', label: 'Serums' },
  { value: 'cream', label: 'Creams' },
  { value: 'scrub', label: 'Scrubs' },
  { value: 'hair-oil', label: 'Hair Oils' },
  { value: 'shampoo', label: 'Shampoo' },
  { value: 'combo', label: 'Combo Packs' },
];

const SKIN_TYPES = [
  { value: 'oily', label: 'Oily' },
  { value: 'dry', label: 'Dry' },
  { value: 'combination', label: 'Combination' },
  { value: 'sensitive', label: 'Sensitive' },
  { value: 'normal', label: 'Normal' },
  { value: 'all', label: 'All types' },
];

const SKIN_CONCERNS = [
  { value: 'acne', label: 'Acne' },
  { value: 'pigmentation', label: 'Dark Spot & Pigmentation' },
  { value: 'tan', label: 'Tan' },
  { value: 'dry-skin', label: 'Dry skin' },
  { value: 'dullness', label: 'Dullness' },
  { value: 'aging', label: 'Anti-aging' },
  { value: 'oily-skin', label: 'Oily skin' },
];

const HAIR_CONCERNS = [
  { value: 'hair-fall', label: 'Hair fall' },
  { value: 'dandruff', label: 'Dandruff' },
  { value: 'frizz', label: 'Frizz' },
  { value: 'dry-scalp', label: 'Dry scalp' },
  { value: 'thinning', label: 'Thinning' },
  { value: 'damage', label: 'Damage' },
];

const PRICE_BUCKETS = [
  { value: '0-400', label: 'Under ₹400' },
  { value: '400-700', label: '₹400 - ₹700' },
  { value: '700-1200', label: '₹700 - ₹1,200' },
  { value: '1200-', label: 'Above ₹1,200' },
];

const RATINGS = [
  { value: '4', label: '4★ & up' },
  { value: '3', label: '3★ & up' },
];

interface Props {
  className?: string;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export function ShopFilters({ className, onClose, showCloseButton = false }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const toggle = useCallback(
    (key: string, value: string) => {
      const sp = new URLSearchParams(params.toString());
      const current = sp.getAll(key);
      if (current.includes(value)) {
        const remaining = current.filter((v) => v !== value);
        sp.delete(key);
        remaining.forEach((v) => sp.append(key, v));
      } else {
        sp.append(key, value);
      }
      router.push(`/shop?${sp.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const setSingle = useCallback(
    (key: string, value: string | null) => {
      const sp = new URLSearchParams(params.toString());
      if (value) sp.set(key, value);
      else sp.delete(key);
      router.push(`/shop?${sp.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const isActive = (key: string, value: string) => params.getAll(key).includes(value);
  const hasAny = Array.from(params.entries()).filter(([k]) => k !== 'sort').length > 0;

  return (
    <aside className={cn('flex flex-col gap-7 rounded-3xl bg-white border border-navy-900/5 shadow-soft p-6', className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-semibold text-navy-900">Filters</h3>
        <div className="flex items-center gap-2">
          {hasAny && (
            <button
              onClick={() => router.push('/shop', { scroll: false })}
              className="text-xs font-bold text-blush hover:text-blush-600 uppercase tracking-wider"
            >
              Reset all
            </button>
          )}
          {showCloseButton && (
            <button onClick={onClose} aria-label="Close filters" className="rounded-full p-1.5 hover:bg-brand-500/10">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <FilterGroup title="Category">
        {CATEGORIES.map((c) => (
          <Chip key={c.value} active={isActive('category', c.value)} onClick={() => toggle('category', c.value)}>
            {c.label}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup title="Skin type">
        {SKIN_TYPES.map((c) => (
          <Chip key={c.value} active={isActive('skinType', c.value)} onClick={() => toggle('skinType', c.value)}>
            {c.label}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup title="Skin concern">
        {SKIN_CONCERNS.map((c) => (
          <Chip key={c.value} active={isActive('concern', c.value)} onClick={() => toggle('concern', c.value)}>
            {c.label}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup title="Hair concern">
        {HAIR_CONCERNS.map((c) => (
          <Chip key={c.value} active={isActive('concern', c.value)} onClick={() => toggle('concern', c.value)}>
            {c.label}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup title="Price">
        {PRICE_BUCKETS.map((p) => (
          <Chip
            key={p.value}
            active={params.get('price') === p.value}
            onClick={() => setSingle('price', params.get('price') === p.value ? null : p.value)}
          >
            {p.label}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup title="Rating">
        {RATINGS.map((r) => (
          <Chip
            key={r.value}
            active={params.get('minRating') === r.value}
            onClick={() => setSingle('minRating', params.get('minRating') === r.value ? null : r.value)}
          >
            {r.label}
          </Chip>
        ))}
      </FilterGroup>
    </aside>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-navy-900">{title}</h4>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}
