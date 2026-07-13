'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { HomepagePayload } from '@/types/api';

/**
 * The live homepage payload from `GET /api/homepage`.
 *
 * Same production-hazard rule as {@link useCatalog}: no mock fallback, no
 * `initialData`. The product arrays (`bestsellers` / `newArrivals` /
 * `comboPacks`) carry real DB product ids and must never be shadowed by phantom
 * mock rows — an outage renders an honest empty state, not fictional products.
 * While loading, callers get `undefined` data and render nothing (or a
 * skeleton); on failure they get `isError` and render nothing.
 */
export function useHomepage(): {
  data: HomepagePayload | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['homepage'],
    queryFn: () => api.homepage(),
    staleTime: 5 * 60 * 1000,
  });
  return { data, isLoading, isError };
}
