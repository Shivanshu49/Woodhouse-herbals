'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ProductSummary } from '@/types';

/**
 * The live product catalog (`ProductSummary[]`) from `GET /api/products`.
 *
 * There is deliberately NO mock fallback and NO `initialData`. Once the catalog
 * is real, silently falling back to bundled mock data is a production hazard: an
 * API outage would serve phantom products — fake ids that 404 on
 * `POST /cart/items`, fictional prices shown to real customers. An API failure
 * must surface an honest empty/error state instead, never invented rows. First
 * paint shows a skeleton (`isLoading`); a failed fetch reports `isError`.
 */
export function useCatalog(): {
  products: ProductSummary[];
  isLoading: boolean;
  isError: boolean;
} {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['catalog'],
    queryFn: () => api.products().then((r) => r.items),
    staleTime: 5 * 60 * 1000,
  });
  return { products: data ?? [], isLoading, isError };
}
