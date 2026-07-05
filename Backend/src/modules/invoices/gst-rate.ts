import { GstRate, OrderStatus, PaymentMethod } from '@prisma/client';

export function gstRatePercent(rate: GstRate): number {
  switch (rate) {
    case GstRate.EXEMPT:
      return 0;
    case GstRate.GST_5:
      return 5;
    case GstRate.GST_12:
      return 12;
    case GstRate.GST_18:
      return 18;
    case GstRate.GST_28:
      return 28;
  }
}

const INVOICEABLE_COMMON: readonly OrderStatus[] = [
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.REFUNDED,
];

/**
 * COD: a GST goods invoice travels with the package, so it is invoiceable from
 * PROCESSING (before payment). PREPAID: money captured, so from PAID onward.
 * PENDING and CANCELLED are never invoiceable.
 */
export function isInvoiceable(status: OrderStatus, method: PaymentMethod): boolean {
  if (INVOICEABLE_COMMON.includes(status)) return true;
  return method === PaymentMethod.PREPAID && status === OrderStatus.PAID;
}
