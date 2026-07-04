'use client';

import { useCallback, useMemo, useState } from 'react';
import type { StatusFilter } from '@/lib/product-meta';
import type {
  AdminProductListParams,
  AdminProductSort,
  ProductCategory,
  StockBucket,
} from '@/types/product';

export interface ProductsView {
  q: string;
  status: StatusFilter;
  category?: ProductCategory;
  stock?: StockBucket;
  priceMin?: number;
  priceMax?: number;
  sort: AdminProductSort;
  page: number;
  perPage: number;
}

const DEFAULT_VIEW: ProductsView = {
  q: '',
  status: 'ALL',
  sort: 'newest',
  page: 1,
  perPage: 25,
};

/** Which of the filter controls (not search/sort) are currently narrowing. */
export function activeFilterCount(v: ProductsView): number {
  let n = 0;
  if (v.status !== 'ALL') n++;
  if (v.category) n++;
  if (v.stock) n++;
  if (v.priceMin !== undefined || v.priceMax !== undefined) n++;
  return n;
}

function toApiParams(v: ProductsView): AdminProductListParams {
  const params: AdminProductListParams = {
    q: v.q.trim() || undefined,
    category: v.category,
    stock: v.stock,
    priceMin: v.priceMin,
    priceMax: v.priceMax,
    sort: v.sort,
    page: v.page,
    perPage: v.perPage,
  };
  // The UI status filter folds two API concepts: a real ProductStatus, or the
  // archived (soft-deleted) state which is a separate `deleted` flag.
  if (v.status === 'ARCHIVED') params.deleted = true;
  else if (v.status !== 'ALL') params.status = v.status;
  return params;
}

export function useProductsView() {
  const [view, setView] = useState<ProductsView>(DEFAULT_VIEW);

  const patch = useCallback((partial: Partial<ProductsView>, resetPage = true) => {
    setView((prev) => ({ ...prev, ...partial, ...(resetPage ? { page: 1 } : {}) }));
  }, []);

  const setSearch = useCallback((q: string) => patch({ q }), [patch]);
  const setSort = useCallback((sort: AdminProductSort) => patch({ sort }), [patch]);
  const setFilter = useCallback(
    (partial: Partial<Pick<ProductsView, 'status' | 'category' | 'stock' | 'priceMin' | 'priceMax'>>) =>
      patch(partial),
    [patch],
  );
  const setPage = useCallback((page: number) => patch({ page }, false), [patch]);
  const setPerPage = useCallback((perPage: number) => patch({ perPage }), [patch]);

  const clearFilters = useCallback(
    () =>
      setView((prev) => ({
        ...DEFAULT_VIEW,
        // Preserve the user's sort + page size; clear the narrowing bits.
        sort: prev.sort,
        perPage: prev.perPage,
      })),
    [],
  );

  const apiParams = useMemo(() => toApiParams(view), [view]);

  return {
    view,
    apiParams,
    filterCount: activeFilterCount(view),
    setSearch,
    setSort,
    setFilter,
    setPage,
    setPerPage,
    clearFilters,
  };
}
