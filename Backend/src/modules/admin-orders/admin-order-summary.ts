import type { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';

/** Shape the list `select` returns — payments ordered desc, take 1 (latest first). */
export interface OrderSummaryRow {
  id: string;
  number: string;
  placedAt: Date;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  totalMinor: number;
  shippingFullName: string;
  userId: string | null;
  payments: { status: PaymentStatus }[];
  _count: { items: number };
}

export interface OrderSummary {
  id: string;
  number: string;
  placedAt: Date;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  totalMinor: number;
  customerName: string;
  isGuest: boolean;
  paymentStatus: PaymentStatus | null;
  itemCount: number;
}

export function toOrderSummary(row: OrderSummaryRow): OrderSummary {
  return {
    id: row.id,
    number: row.number,
    placedAt: row.placedAt,
    status: row.status,
    // COD vs PREPAID — visible at a glance; the refund flow branches on it.
    paymentMethod: row.paymentMethod,
    totalMinor: row.totalMinor,
    // shippingFullName is a required column (guest checkout still collects it),
    // so this is the real name; fall back to 'Guest' only if it's ever blank.
    customerName: row.shippingFullName?.trim() || 'Guest',
    isGuest: row.userId === null,
    // Display-only heuristic: the latest payment's status. The list *filter*
    // (`payments: { some }`) uses any-match, so for an order with a FAILED retry
    // after a SUCCESS the badge and the filter can legitimately disagree.
    paymentStatus: row.payments[0]?.status ?? null,
    itemCount: row._count.items,
  };
}
