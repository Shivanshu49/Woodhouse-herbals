import { ConflictException } from '@nestjs/common';
import { OrderStatus, RefundDisposition } from '@prisma/client';

/**
 * Post-money states an admin may refund from (spec §2.1). PAID/PROCESSING are NOT
 * directly refundable — they must be cancelled first (which restocks pre-shipment),
 * then the cancelled-paid order is refunded. SHIPPED is directly refundable
 * (lost-in-transit / RTO). REFUNDED is terminal.
 */
export const REFUNDABLE_STATUSES: readonly OrderStatus[] = [
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
];

export function canRefundStatus(status: OrderStatus): boolean {
  return REFUNDABLE_STATUSES.includes(status);
}

export function assertRefundable(status: OrderStatus): void {
  if (!canRefundStatus(status)) {
    throw new ConflictException(
      `An order in ${status} status cannot be refunded. Cancel it first (which restocks pre-shipment), then refund the cancelled order.`,
    );
  }
}

/**
 * Deterministic, alphanumeric, gateway-safe refund id (max 38 chars). Because
 * it is derived from the refund row id, a retry reuses the SAME id, so it is
 * stable as both the Razorpay `receipt` and the X-Refund-Idempotency key — the
 * provider dedupes a retry rather than double-refunding.
 * (The provider state→RefundStatus mapping lives in
 * razorpay-states.ts::mapRazorpayRefundState.)
 */
export function deriveMerchantRefundId(refundId: string): string {
  return `RF${refundId.replace(/[^A-Za-z0-9]/g, '')}`.slice(0, 38);
}

export function shouldRestock(disposition: RefundDisposition): boolean {
  return disposition === RefundDisposition.RETURNED;
}
