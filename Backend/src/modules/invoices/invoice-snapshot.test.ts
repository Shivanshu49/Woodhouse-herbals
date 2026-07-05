import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot, type SnapshotOrder } from './invoice-snapshot';
import type { InvoiceProfile } from '../store-settings/store-profile';

const profile: InvoiceProfile = {
  legalName: 'WHH', gstin: '29ABCDE1234F1Z5', address: 'BLR', pan: 'ABCDE1234F',
  state: 'Karnataka', stateCode: '29', shippingGstRatePercent: 18,
};
const order: SnapshotOrder = {
  number: 'WH-1', paymentMethod: 'COD', discountMinor: 0, shippingMinor: 0, totalMinor: 39800,
  shippingFullName: 'Buyer', shippingGstin: null, shippingState: 'Karnataka',
  shippingLine1: '1 St', shippingLine2: null, shippingCity: 'BLR', shippingPincode: '560001',
  items: [
    {
      productNameSnapshot: 'A', hsnSnapshot: '3304', gstRateSnapshot: 18, quantity: 2,
      unitPriceMinor: 19900, lineTotalMinor: 39800, product: { hsnCode: '3304', gstRate: 'GST_18' },
    },
  ],
};

test('buildSnapshot fills number/date/tax and flags catalogue fallback per line', () => {
  const s = buildSnapshot({ order, profile, number: 'INV-2026-27-00001', issuedAt: new Date('2026-07-05T00:00:00Z') });
  assert.equal(s.number, 'INV-2026-27-00001');
  assert.equal(s.tax.grandTotalMinor, 39800);
  assert.equal(s.tax.intraState, true);
  assert.equal(s.catalogueFallback, false); // snapshot present → exact-at-sale
  assert.equal(s.amountInWords.startsWith('Rupees'), true);
  assert.equal(s.paymentNote.includes('COD') || s.paymentNote.includes('Cash on Delivery'), true);
});

test('buildSnapshot falls back to current product HSN/rate when the snapshot is null', () => {
  const legacy: SnapshotOrder = {
    ...order,
    items: [{ ...order.items[0], hsnSnapshot: null, gstRateSnapshot: null }],
  };
  const s = buildSnapshot({ order: legacy, profile, number: 'INV-2026-27-00002', issuedAt: new Date() });
  assert.equal(s.catalogueFallback, true);
  assert.equal(s.tax.lines[0].hsn, '3304'); // from product.hsnCode
  assert.equal(s.tax.lines[0].gstRatePercent, 18); // from product.gstRate GST_18
});
