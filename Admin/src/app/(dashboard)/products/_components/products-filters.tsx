'use client';

import { useEffect, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';
import {
  CATEGORY_OPTIONS,
  STATUS_FILTER_OPTIONS,
  STOCK_OPTIONS,
  type StatusFilter,
} from '@/lib/product-meta';
import type { ProductCategory, StockBucket } from '@/types/product';
import type { ProductsView } from './use-products-view';

type FilterPatch = Partial<
  Pick<ProductsView, 'status' | 'category' | 'stock' | 'priceMin' | 'priceMax'>
>;

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input bg-background text-foreground hover:bg-accent',
      )}
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

export function ProductsFilters({
  view,
  setFilter,
  clearFilters,
  filterCount,
}: {
  view: ProductsView;
  setFilter: (patch: FilterPatch) => void;
  clearFilters: () => void;
  filterCount: number;
}) {
  // Price is committed on blur so we don't fire a query per keystroke.
  const [priceMin, setPriceMin] = useState<string>(view.priceMin?.toString() ?? '');
  const [priceMax, setPriceMax] = useState<string>(view.priceMax?.toString() ?? '');

  useEffect(() => {
    setPriceMin(view.priceMin?.toString() ?? '');
    setPriceMax(view.priceMax?.toString() ?? '');
  }, [view.priceMin, view.priceMax]);

  function commitPrice() {
    const min = priceMin.trim() === '' ? undefined : Math.max(0, Math.floor(Number(priceMin)));
    const max = priceMax.trim() === '' ? undefined : Math.max(0, Math.floor(Number(priceMax)));
    setFilter({
      priceMin: Number.isFinite(min as number) ? min : undefined,
      priceMax: Number.isFinite(max as number) ? max : undefined,
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {filterCount > 0 ? (
            <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
              {filterCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Filters</p>
          {filterCount > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Clear all
            </button>
          ) : null}
        </div>

        <Section title="Status">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTER_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                active={view.status === o.value}
                onClick={() => setFilter({ status: o.value as StatusFilter })}
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Category">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                active={view.category === o.value}
                onClick={() =>
                  setFilter({
                    category: view.category === o.value ? undefined : (o.value as ProductCategory),
                  })
                }
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Stock level">
          <div className="flex flex-wrap gap-1.5">
            {STOCK_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                active={view.stock === o.value}
                onClick={() =>
                  setFilter({ stock: view.stock === o.value ? undefined : (o.value as StockBucket) })
                }
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Price range (₹)">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Min"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              onBlur={commitPrice}
              className="h-8"
              aria-label="Minimum price in rupees"
            />
            <span className="text-muted-foreground">—</span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Max"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              onBlur={commitPrice}
              className="h-8"
              aria-label="Maximum price in rupees"
            />
          </div>
        </Section>
      </PopoverContent>
    </Popover>
  );
}
