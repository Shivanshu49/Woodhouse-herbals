/**
 * Pure unit tests for order-total composition. No Prisma, no IO.
 * Run with: `npm test` (auto-discovered under src/) or
 *           `npx tsx --test src/modules/orders/order-pricing.test.ts`
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeOrderTotals } from './order-pricing';

test('no discount, no GST: total = subtotal + shipping, tax = 0', () => {
  const t = computeOrderTotals({
    subtotalMinor: 50000,
    discountMinor: 0,
    shippingMinor: 5900,
    gstRatePercent: 0,
  });
  assert.equal(t.totalMinor, 55900);
  assert.equal(t.taxMinor, 0);
  assert.equal(t.discountMinor, 0);
});

test('GST is the inclusive component of the total (price unchanged)', () => {
  // 18% GST embedded in ₹559.00 → 559 * 18 / 118 = 85.27... → ₹85.27
  const t = computeOrderTotals({
    subtotalMinor: 50000,
    discountMinor: 0,
    shippingMinor: 5900,
    gstRatePercent: 18,
  });
  assert.equal(t.totalMinor, 55900); // customer pays the same as without tax
  assert.equal(t.taxMinor, 8527);
});

test('discount reduces the goods value before tax/total', () => {
  // subtotal ₹1000, ₹200 off, free shipping, 18% GST.
  // total = 80000; tax = round(80000 * 18 / 118) = 12203
  const t = computeOrderTotals({
    subtotalMinor: 100000,
    discountMinor: 20000,
    shippingMinor: 0,
    gstRatePercent: 18,
  });
  assert.equal(t.discountMinor, 20000);
  assert.equal(t.totalMinor, 80000);
  assert.equal(t.taxMinor, 12203);
});

test('discount can never exceed the subtotal (no negative payable)', () => {
  const t = computeOrderTotals({
    subtotalMinor: 4000,
    discountMinor: 10000, // ₹100 flat on a ₹40 cart
    shippingMinor: 5900,
    gstRatePercent: 18,
  });
  assert.equal(t.discountMinor, 4000); // clamped to subtotal
  assert.equal(t.totalMinor, 5900); // goods 0 + shipping
});

test('negative / fractional inputs are clamped and truncated', () => {
  const t = computeOrderTotals({
    subtotalMinor: 10000.7,
    discountMinor: -50,
    shippingMinor: -100,
    gstRatePercent: 18,
  });
  assert.equal(t.subtotalMinor, 10000);
  assert.equal(t.discountMinor, 0);
  assert.equal(t.shippingMinor, 0);
  assert.equal(t.totalMinor, 10000);
});

test('zero-value order yields zero tax', () => {
  const t = computeOrderTotals({
    subtotalMinor: 0,
    discountMinor: 0,
    shippingMinor: 0,
    gstRatePercent: 18,
  });
  assert.equal(t.totalMinor, 0);
  assert.equal(t.taxMinor, 0);
});
