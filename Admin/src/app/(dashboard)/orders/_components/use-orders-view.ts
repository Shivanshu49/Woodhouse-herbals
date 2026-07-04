'use client';

import { useMemo, useState } from 'react';
import {
  DEFAULT_ORDERS_VIEW,
  activeOrderFilterCount,
  ordersViewToParams,
  type OrdersView,
} from '@/lib/order-meta';
import type { AdminOrderSort, OrderStatus, PaymentMethod, PaymentStatus } from '@/types/order';

/** In-memory list state (state lives in React, not the URL — mirrors products). */
export function useOrdersView() {
  const [view, setView] = useState<OrdersView>(DEFAULT_ORDERS_VIEW);

  function patch(partial: Partial<OrdersView>, resetPage = true) {
    setView((v) => ({ ...v, ...partial, ...(resetPage ? { page: 1 } : {}) }));
  }

  return {
    view,
    apiParams: useMemo(() => ordersViewToParams(view), [view]),
    filterCount: activeOrderFilterCount(view),
    setSearch: (q: string) => patch({ q }),
    setSort: (sort: AdminOrderSort) => patch({ sort }),
    toggleStatus: (s: OrderStatus) =>
      setView((v) => ({
        ...v,
        statuses: v.statuses.includes(s) ? v.statuses.filter((x) => x !== s) : [...v.statuses, s],
        page: 1,
      })),
    setPaymentStatus: (paymentStatus?: PaymentStatus) => patch({ paymentStatus }),
    setPaymentMethod: (paymentMethod?: PaymentMethod) => patch({ paymentMethod }),
    setDateRange: (dateFrom?: string, dateTo?: string) => patch({ dateFrom, dateTo }),
    clearFilters: () =>
      patch({
        statuses: [],
        paymentStatus: undefined,
        paymentMethod: undefined,
        dateFrom: undefined,
        dateTo: undefined,
      }),
    setPage: (page: number) => patch({ page }, false),
    setPerPage: (perPage: number) => patch({ perPage }),
  };
}

export type OrdersViewApi = ReturnType<typeof useOrdersView>;
