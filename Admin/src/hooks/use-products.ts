import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import type { AdminProductListParams } from '@/types/product';

/**
 * Server-driven products list. The query key carries every filter/sort/page
 * param so each view caches independently; `keepPreviousData` keeps the last
 * view on screen while the next one loads, so changing a filter or page never
 * flashes the table empty.
 */
export function useProducts(params: AdminProductListParams) {
  return useQuery({
    queryKey: qk.products.list(params),
    queryFn: () => api.products.list(params),
    placeholderData: keepPreviousData,
  });
}
