import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/types/order';

/** Semantic tones → concrete Tailwind classes live in the badges component. */
export type BadgeTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'indigo'
  | 'violet'
  | 'neutral';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  PAID: 'Paid',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

/** Distinct tone per state so all 7 are visually separable. */
export const ORDER_STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  PENDING: 'warning',
  PAID: 'info',
  PROCESSING: 'indigo',
  SHIPPED: 'violet',
  DELIVERED: 'success',
  CANCELLED: 'neutral',
  REFUNDED: 'danger',
};

/** Mirrors the backend cancel guard (§2.1): only pre-shipment states cancel. */
const CANCELLABLE: readonly OrderStatus[] = ['PENDING', 'PAID', 'PROCESSING'];

export function canCancelOrderStatus(status: OrderStatus): boolean {
  return CANCELLABLE.includes(status);
}

/** Mirrors the backend REFUNDABLE_STATUSES (D1b). */
const REFUNDABLE: readonly OrderStatus[] = ['SHIPPED', 'DELIVERED', 'CANCELLED'];

export function canRefundOrderStatus(status: OrderStatus): boolean {
  return REFUNDABLE.includes(status);
}

/**
 * The SINGLE source of truth for whether the refund action is available — a
 * refundable status AND the ADMIN role (MANAGER excluded, mirrors the backend
 * @Roles(ADMIN)). Both the header button and the refunds-panel button call this.
 */
export function refundGate(
  order: { status: OrderStatus },
  role: string | undefined,
): { allowed: boolean; reason?: string } {
  if (!canRefundOrderStatus(order.status)) {
    return { allowed: false, reason: `An order in ${order.status} status cannot be refunded.` };
  }
  if (role !== 'ADMIN') return { allowed: false, reason: 'Refunds are ADMIN-only.' };
  return { allowed: true };
}

/** Mirrors the backend isInvoiceable gate: COD from PROCESSING, prepaid from PAID. */
const INVOICEABLE_COMMON: readonly OrderStatus[] = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'REFUNDED'];

export function canDownloadInvoice(status: OrderStatus, method: PaymentMethod): boolean {
  if (INVOICEABLE_COMMON.includes(status)) return true;
  return method === 'PREPAID' && status === 'PAID';
}

export interface PaymentBadge {
  label: string;
  tone: BadgeTone;
}

/**
 * The list payment badge. COD renders from the METHOD (its paymentStatus is null
 * and payments are collected off-band), never a blank badge; prepaid renders from
 * the latest payment status; a prepaid order with no payment yet reads "Unpaid".
 */
export function paymentBadge(row: {
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus | null;
}): PaymentBadge {
  if (row.paymentMethod === 'COD') return { label: 'COD', tone: 'neutral' };
  switch (row.paymentStatus) {
    case 'SUCCESS':
      return { label: 'Paid', tone: 'success' };
    case 'INITIATED':
      return { label: 'Pending', tone: 'warning' };
    case 'FAILED':
      return { label: 'Failed', tone: 'danger' };
    case 'REFUNDED':
      return { label: 'Refunded', tone: 'info' };
    case 'PARTIALLY_REFUNDED':
      return { label: 'Part. refunded', tone: 'info' };
    default:
      return { label: 'Unpaid', tone: 'neutral' };
  }
}
