import type {
  AdminOrderListParams,
  AdminOrderSort,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@/types/order';

/** In-memory list state (mirrors the products list — state lives in React, not the URL). */
export interface OrdersView {
  q: string;
  statuses: OrderStatus[];
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  sort: AdminOrderSort;
  page: number;
  perPage: number;
}

export const DEFAULT_ORDERS_VIEW: OrdersView = {
  q: '',
  statuses: [],
  sort: 'newest',
  page: 1,
  perPage: 25,
};

export function ordersViewToParams(view: OrdersView): AdminOrderListParams {
  const q = view.q.trim();
  return {
    q: q || undefined,
    status: view.statuses.length ? view.statuses.join(',') : undefined,
    paymentStatus: view.paymentStatus,
    paymentMethod: view.paymentMethod,
    dateFrom: view.dateFrom || undefined,
    dateTo: view.dateTo || undefined,
    sort: view.sort,
    page: view.page,
    perPage: view.perPage,
  };
}

/** Count of active narrowing filters (drives the filter-count badge). q is separate. */
export function activeOrderFilterCount(view: OrdersView): number {
  let n = 0;
  if (view.statuses.length) n++;
  if (view.paymentStatus) n++;
  if (view.paymentMethod) n++;
  if (view.dateFrom || view.dateTo) n++;
  return n;
}

// --- Option lists for the toolbar/filters UI ---

export const ORDER_SORT_OPTIONS: { value: AdminOrderSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'total_high', label: 'Total: high → low' },
  { value: 'total_low', label: 'Total: low → high' },
];

export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REFUNDED', label: 'Refunded' },
];

export const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'SUCCESS', label: 'Paid' },
  { value: 'INITIATED', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'PARTIALLY_REFUNDED', label: 'Partially refunded' },
];

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'PREPAID', label: 'Prepaid' },
  { value: 'COD', label: 'COD' },
];
