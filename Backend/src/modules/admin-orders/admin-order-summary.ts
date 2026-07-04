import type { OrderStatus, PaymentStatus } from '@prisma/client';

/** Shape the list `select` returns — payments ordered desc, take 1 (latest first). */
export interface OrderSummaryRow {
  id: string;
  number: string;
  placedAt: Date;
  status: OrderStatus;
  totalMinor: number;
  shippingFullName: string;
  payments: { status: PaymentStatus }[];
  _count: { items: number };
}

export interface OrderSummary {
  id: string;
  number: string;
  placedAt: Date;
  status: OrderStatus;
  totalMinor: number;
  customerName: string;
  paymentStatus: PaymentStatus | null;
  itemCount: number;
}

export function toOrderSummary(row: OrderSummaryRow): OrderSummary {
  return {
    id: row.id,
    number: row.number,
    placedAt: row.placedAt,
    status: row.status,
    totalMinor: row.totalMinor,
    customerName: row.shippingFullName,
    // Display-only heuristic: the latest payment's status. The list *filter*
    // (`payments: { some }`) uses any-match, so for an order with a FAILED retry
    // after a SUCCESS the badge and the filter can legitimately disagree.
    paymentStatus: row.payments[0]?.status ?? null,
    itemCount: row._count.items,
  };
}
