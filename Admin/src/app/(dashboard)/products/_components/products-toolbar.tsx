'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SORT_OPTIONS } from '@/lib/product-meta';
import type { AdminProductSort } from '@/types/product';
import { ProductsFilters } from './products-filters';
import type { ProductsView } from './use-products-view';

type FilterPatch = Partial<
  Pick<ProductsView, 'status' | 'category' | 'stock' | 'priceMin' | 'priceMax'>
>;

export function ProductsToolbar({
  view,
  filterCount,
  setSearch,
  setSort,
  setFilter,
  clearFilters,
}: {
  view: ProductsView;
  filterCount: number;
  setSearch: (q: string) => void;
  setSort: (sort: AdminProductSort) => void;
  setFilter: (patch: FilterPatch) => void;
  clearFilters: () => void;
}) {
  // Debounced search: type into local state, push to the query after a pause.
  const [term, setTerm] = useState(view.q);
  const firstRun = useRef(true);

  // Keep the input in sync if the query is cleared elsewhere (e.g. Clear all).
  useEffect(() => {
    setTerm(view.q);
  }, [view.q]);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const id = setTimeout(() => {
      if (term !== view.q) setSearch(term);
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const activeSort = SORT_OPTIONS.find((o) => o.value === view.sort) ?? SORT_OPTIONS[0];

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[16rem] flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by name or SKU…"
          className="pl-9"
          aria-label="Search products"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ProductsFilters
          view={view}
          setFilter={setFilter}
          clearFilters={clearFilters}
          filterCount={filterCount}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowUpDown className="h-4 w-4" />
              <span className="hidden sm:inline">Sort: </span>
              {activeSort.label}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={view.sort}
              onValueChange={(v) => setSort(v as AdminProductSort)}
            >
              {SORT_OPTIONS.map((o) => (
                <DropdownMenuRadioItem key={o.value} value={o.value}>
                  {o.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
