import type { Paginated } from './product';

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentStatus =
  | 'INITIATED'
  | 'SUCCESS'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type PaymentMethod = 'PREPAID' | 'COD';

export type AdminOrderSort = 'newest' | 'oldest' | 'total_high' | 'total_low';

/** One row of GET /admin/orders (the thin summary the backend returns). */
export interface AdminOrderRow {
  id: string;
  number: string;
  placedAt: string; // ISO
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  totalMinor: number;
  customerName: string;
  isGuest: boolean;
  paymentStatus: PaymentStatus | null;
  itemCount: number;
}

export type AdminOrdersList = Paginated<AdminOrderRow>;

/** Query params for GET /admin/orders. `status` is a comma-joined list. */
export interface AdminOrderListParams {
  q?: string;
  status?: string;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  dateFrom?: string; // YYYY-MM-DD (backend treats dateTo as inclusive end-of-day)
  dateTo?: string;
  sort?: AdminOrderSort;
  page?: number;
  perPage?: number;
}

export interface AddOrderNoteBody {
  body: string;
  isCustomerVisible?: boolean;
}

export interface CancelOrderBody {
  reason: string;
}

// --- Detail (used by D3; typed loosely here since the list page doesn't render it) ---
export interface OrderItemDetail {
  id: string;
  productNameSnapshot: string;
  productImageSnapshot: string;
  skuSnapshot: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

export type RefundMethod = 'PHONEPE' | 'MANUAL';
export type RefundStatus = 'PENDING' | 'PROCESSED' | 'FAILED';
export type RefundDisposition = 'RETURNED' | 'DAMAGED' | 'LOST';

export interface Refund {
  id: string;
  method: RefundMethod;
  status: RefundStatus;
  disposition: RefundDisposition;
  amountMinor: number;
  utrReference: string | null;
  merchantRefundId: string | null;
  providerRefundId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface InvoiceMeta {
  number: string;
  fy: string;
  issuedAt: string;
}

export interface ShipmentDetail {
  id: string;
  courier: string;
  trackingNumber: string | null;
  status: string;
  events: Array<{ id: string; status: string; description: string | null; occurredAt: string }>;
}

export interface RefundBody {
  disposition: RefundDisposition;
  reason?: string;
}
export interface ManualRefundBody {
  utrReference: string;
  disposition: RefundDisposition;
  reason?: string;
}

export interface OrderEventDetail {
  id: string;
  type: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus | null;
  note: string | null;
  meta: unknown;
  createdAt: string;
  actor: { id: string; fullName: string } | null;
}

export interface OrderDetail {
  id: string;
  number: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  shippingFullName: string;
  shippingPhone: string;
  shippingLine1: string;
  shippingLine2: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  shippingCountry: string;
  shippingGstin: string | null;
  placedAt: string;
  items: OrderItemDetail[];
  events: OrderEventDetail[];
  notes: Array<{ id: string; body: string; isCustomerVisible: boolean; createdAt: string }>;
  payments: Array<{ id: string; provider: string; providerTxnId: string | null; amountMinor: number; status: PaymentStatus }>;
  refunds: Refund[];
  shipments: ShipmentDetail[];
  invoice: InvoiceMeta | null;
  user: { id: string; fullName: string; email: string | null; phone: string | null } | null;
}
