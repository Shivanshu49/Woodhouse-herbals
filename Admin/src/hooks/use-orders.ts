import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import type { AdminOrderListParams } from '@/types/order';

/**
 * The orders list. Orders are live (the storefront is taking them), so we keep
 * previous data across filter/page changes AND refetch on window focus + a gentle
 * interval so new orders surface without a manual refresh (no websockets needed).
 */
export function useOrders(params: AdminOrderListParams) {
  return useQuery({
    queryKey: qk.orders.list(params),
    queryFn: () => api.orders.list(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });
}
