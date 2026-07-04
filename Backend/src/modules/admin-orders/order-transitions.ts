import { ConflictException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

/** Statuses an admin may cancel from — pre-shipment only (spec §2.1). */
export const CANCELLABLE_STATUSES: readonly OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
];

export function canCancel(status: OrderStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status);
}

/** Throws 409 if the order cannot be cancelled from its current status. */
export function assertCancellable(status: OrderStatus): void {
  if (!canCancel(status)) {
    throw new ConflictException(
      `Cannot cancel an order in ${status} status — only ${CANCELLABLE_STATUSES.join(
        ', ',
      )} orders can be cancelled. Once shipped, money is returned via the refund path.`,
    );
  }
}
