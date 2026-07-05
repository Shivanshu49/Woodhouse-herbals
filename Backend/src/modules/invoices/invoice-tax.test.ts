import test from 'node:test';
import assert from 'node:assert/strict';
import { computeInvoiceTax, type InvoiceTaxInput } from './invoice-tax';

const base: InvoiceTaxInput = {
  lines: [
    { name: 'A', hsn: '3304', qty: 2, unitPriceMinor: 19900, lineTotalMinor: 39800, gstRatePercent: 18 },
  ],
  discountMinor: 0,
  shippingMinor: 0,
  shippingGstRatePercent: 18,
  buyerState: 'Karnataka',
  storeState: 'Karnataka',
  orderTotalMinor: 39800,
};

test('intra-state: CGST+SGST each half of the (inclusive-derived) tax; reconciles to total', () => {
  const r = computeInvoiceTax(base);
  assert.equal(r.intraState, true);
  const l = r.lines[0];
  assert.equal(l.taxableMinor + l.cgstMinor + l.sgstMinor, 39800); // net reconciles
  assert.equal(l.igstMinor, 0);
  assert.equal(l.cgstMinor + l.sgstMinor, l.grossMinor - l.taxableMinor); // = tax
  assert.equal(Math.abs(l.cgstMinor - l.sgstMinor) <= 1, true); // halves ±1 paise
  assert.equal(r.grandTotalMinor, 39800);
});

test('inter-state: IGST = full line tax, no CGST/SGST', () => {
  const r = computeInvoiceTax({ ...base, buyerState: 'Maharashtra' });
  assert.equal(r.intraState, false);
  assert.equal(r.lines[0].cgstMinor, 0);
  assert.equal(r.lines[0].sgstMinor, 0);
  assert.equal(r.lines[0].igstMinor, r.lines[0].grossMinor - r.lines[0].taxableMinor);
});

test('order discount is apportioned; grand total still reconciles', () => {
  const r = computeInvoiceTax({
    ...base,
    lines: [
      { name: 'A', hsn: '3304', qty: 1, unitPriceMinor: 30000, lineTotalMinor: 30000, gstRatePercent: 18 },
      { name: 'B', hsn: '3304', qty: 1, unitPriceMinor: 10000, lineTotalMinor: 10000, gstRatePercent: 12 },
    ],
    discountMinor: 4000,
    orderTotalMinor: 36000,
  });
  assert.equal(r.grandTotalMinor, 36000);
  assert.equal(
    r.lines.reduce((s, l) => s + l.taxableMinor + l.cgstMinor + l.sgstMinor + l.igstMinor, 0),
    36000,
  );
});

test('shipping becomes its own taxable line', () => {
  const r = computeInvoiceTax({ ...base, shippingMinor: 5000, orderTotalMinor: 44800 });
  assert.equal(r.lines.length, 2);
  assert.equal(r.lines[1].grossMinor, 5000);
  assert.equal(r.grandTotalMinor, 44800);
});

test('blank/unknown buyer state → inter-state + ambiguous flag (never blocks)', () => {
  const r = computeInvoiceTax({ ...base, buyerState: '' });
  assert.equal(r.intraState, false);
  assert.equal(r.ambiguousPlaceOfSupply, true);
  assert.equal(r.grandTotalMinor, 39800);
});
