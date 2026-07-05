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
 * Deterministic, alphanumeric, PhonePe-safe refund id (max 38 chars). Because it
 * is derived from the refund row id, a network retry reuses the SAME id, so
 * PhonePe dedupes rather than double-refunding.
 */
export function deriveMerchantRefundId(refundId: string): string {
  return `RF${refundId.replace(/[^A-Za-z0-9]/g, '')}`.slice(0, 38);
}

/** The provider-call outcome beyond `data.state` — undefined for inbound callbacks. */
export interface ProviderOutcome {
  /** HTTP status of the S2S call (2xx accepted, 4xx client rejection, 5xx transient). */
  httpStatus?: number;
  /** PhonePe top-level `success` flag when present in the body. */
  success?: boolean;
}

/**
 * PhonePe refund `data.state` (+ optional S2S outcome) → our RefundStatus token.
 *
 * A definitive REJECTION (HTTP 4xx, or an explicit `success:false` on a non-5xx
 * response, with no terminal `data.state`) means PhonePe did NOT accept the
 * refund — e.g. `EXCESS_REFUND_AMOUNT`, `REFUND_FOR_TXN_OLDER_THAN_LIMIT`,
 * `TRANSACTION_NOT_FOUND`. That maps to FAILED so `settle` releases the payment
 * (REFUND_PENDING→SUCCESS) and a retry can proceed — never a stuck REFUND_PENDING.
 *
 * A 5xx / network / genuinely accepted-pending response stays PENDING: we await a
 * callback or Check-Status and NEVER guess that money moved.
 */
export function mapRefundState(
  state: string,
  outcome?: ProviderOutcome,
): 'PROCESSED' | 'FAILED' | 'PENDING' {
  if (state === 'COMPLETED') return 'PROCESSED';
  if (state === 'FAILED') return 'FAILED';
  const http = outcome?.httpStatus;
  if (typeof http === 'number' && http >= 500) return 'PENDING'; // transient — recheck later
  const clientRejected =
    (typeof http === 'number' && http >= 400 && http < 500) || outcome?.success === false;
  if (clientRejected) return 'FAILED'; // definitive rejection — release the payment
  return 'PENDING';
}

export function shouldRestock(disposition: RefundDisposition): boolean {
  return disposition === RefundDisposition.RETURNED;
}
