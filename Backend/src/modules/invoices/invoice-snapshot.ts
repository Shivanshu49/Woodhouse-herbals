import { gstRatePercent } from './gst-rate';
import { computeInvoiceTax, InvoiceTaxResult } from './invoice-tax';
import { amountToWordsINR } from './amount-to-words';
import type { GstRate, PaymentMethod } from '@prisma/client';
import type { InvoiceProfile } from '../store-settings/store-profile';

export interface SnapshotOrderItem {
  productNameSnapshot: string;
  hsnSnapshot: string | null;
  gstRateSnapshot: number | null;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  product: { hsnCode: string | null; gstRate: GstRate };
}
export interface SnapshotOrder {
  number: string;
  paymentMethod: PaymentMethod;
  discountMinor: number;
  shippingMinor: number;
  totalMinor: number;
  shippingFullName: string;
  shippingGstin: string | null;
  shippingState: string;
  shippingLine1: string;
  shippingLine2: string | null;
  shippingCity: string;
  shippingPincode: string;
  items: SnapshotOrderItem[];
}
export interface InvoiceSnapshot {
  number: string;
  issuedAtISO: string;
  orderNumber: string;
  seller: InvoiceProfile;
  buyer: { name: string; gstin: string | null; address: string; state: string };
  tax: InvoiceTaxResult;
  amountInWords: string;
  paymentNote: string;
  catalogueFallback: boolean;
}

/** Freeze the fully-computed invoice from the live order + store profile. Pure. */
export function buildSnapshot(args: {
  order: SnapshotOrder;
  profile: InvoiceProfile;
  number: string;
  issuedAt: Date;
}): InvoiceSnapshot {
  const { order, profile, number, issuedAt } = args;
  let catalogueFallback = false;
  const taxLines = order.items.map((it) => {
    const hsn = it.hsnSnapshot ?? it.product.hsnCode;
    const rate = it.gstRateSnapshot ?? gstRatePercent(it.product.gstRate);
    if (it.hsnSnapshot === null || it.gstRateSnapshot === null) catalogueFallback = true;
    return {
      name: it.productNameSnapshot,
      hsn,
      qty: it.quantity,
      unitPriceMinor: it.unitPriceMinor,
      lineTotalMinor: it.lineTotalMinor,
      gstRatePercent: rate,
    };
  });
  const tax = computeInvoiceTax({
    lines: taxLines,
    discountMinor: order.discountMinor,
    shippingMinor: order.shippingMinor,
    shippingGstRatePercent: profile.shippingGstRatePercent,
    buyerState: order.shippingState,
    storeState: profile.state,
    orderTotalMinor: order.totalMinor,
  });
  const address = [order.shippingLine1, order.shippingLine2, order.shippingCity, order.shippingPincode]
    .filter(Boolean)
    .join(', ');
  return {
    number,
    issuedAtISO: issuedAt.toISOString(),
    orderNumber: order.number,
    seller: profile,
    buyer: { name: order.shippingFullName, gstin: order.shippingGstin, address, state: order.shippingState },
    tax,
    amountInWords: amountToWordsINR(tax.grandTotalMinor),
    paymentNote:
      order.paymentMethod === 'COD'
        ? 'Cash on Delivery — payable on receipt.'
        : 'Paid online (prepaid).',
    catalogueFallback,
  };
}
