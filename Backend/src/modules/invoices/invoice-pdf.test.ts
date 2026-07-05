import test from 'node:test';
import assert from 'node:assert/strict';
import { renderInvoicePdf } from './invoice-pdf';
import { buildSnapshot, type SnapshotOrder } from './invoice-snapshot';
import type { InvoiceProfile } from '../store-settings/store-profile';

const profile: InvoiceProfile = {
  legalName: 'WHH Pvt Ltd', gstin: '29ABCDE1234F1Z5', address: 'BLR', pan: 'ABCDE1234F',
  state: 'Karnataka', stateCode: '29', shippingGstRatePercent: 18,
};
const order: SnapshotOrder = {
  number: 'WH-1', paymentMethod: 'PREPAID', discountMinor: 0, shippingMinor: 5000, totalMinor: 44800,
  shippingFullName: 'Buyer', shippingGstin: '27ZZZZZ0000Z1Z5', shippingState: 'Maharashtra',
  shippingLine1: '1 St', shippingLine2: null, shippingCity: 'Mumbai', shippingPincode: '400001',
  items: [
    {
      productNameSnapshot: 'A', hsnSnapshot: '3304', gstRateSnapshot: 18, quantity: 2,
      unitPriceMinor: 19900, lineTotalMinor: 39800, product: { hsnCode: '3304', gstRate: 'GST_18' },
    },
  ],
};

test('renderInvoicePdf returns a valid PDF buffer (async-drained)', async () => {
  const snapshot = buildSnapshot({ order, profile, number: 'INV-2026-27-00001', issuedAt: new Date('2026-07-05T00:00:00Z') });
  const buf = await renderInvoicePdf(snapshot);
  assert.equal(buf.subarray(0, 5).toString('ascii'), '%PDF-'); // valid PDF header
  assert.equal(buf.length > 800, true); // non-trivial content
});
