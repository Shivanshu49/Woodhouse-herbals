'use client';

import { useQuery } from '@tanstack/react-query';
import { api, withFallback } from '@/lib/api';
import { productSummaries } from '@/data/products';
import type { ProductSummary } from '@/types';

/**
 * The product catalog as `ProductSummary[]`.
 *
 * Prefers the live backend (`GET /api/products`) and falls back to the bundled
 * mock catalog when it's unreachable, so the UI always has data. Seeded with
 * mock data via `initialData` so the first paint is never empty; a successful
 * fetch swaps in live data. Cached for the session by React Query.
 */
export function useCatalog(): ProductSummary[] {
  const { data } = useQuery({
    queryKey: ['catalog'],
    queryFn: () =>
      withFallback(
        () => api.products().then((r) => r.items),
        () => productSummaries,
      ),
    initialData: productSummaries,
    staleTime: 5 * 60 * 1000,
  });
  return data;
}
