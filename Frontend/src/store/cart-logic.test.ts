/**
 * Unit tests for the pure cart transforms (the optimistic-update logic the
 * Option-A store applies before reconciling to the server). Run:
 *   npx tsx --test src/store/cart-logic.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { CartLine, ProductSummary } from '../types';
import {
  optimisticAdd,
  optimisticSetQuantity,
  subtotalOf,
  itemCountOf,
  planCartMigration,
  MAX_PER_LINE,
} from './cart-logic';

const product = (id: string, priceMinor: number): ProductSummary => ({
  id,
  slug: `slug-${id}`,
  name: `Product ${id}`,
  shortDescription: '',
  price: { amount: priceMinor, currency: 'INR' },
  thumbnail: { url: `https://x/${id}.png`, alt: '' },
  rating: 4.5,
  reviewCount: 10,
  category: 'serum',
  concerns: [],
  skinTypes: [],
  inStock: true,
});

const line = (id: string, unit: number, qty: number): CartLine => ({
  productId: id,
  slug: `slug-${id}`,
  name: `Product ${id}`,
  thumbnail: `https://x/${id}.png`,
  unitPrice: { amount: unit, currency: 'INR' },
  quantity: qty,
  lineTotal: { amount: unit * qty, currency: 'INR' },
});

// ------------------------------------------------------------- optimisticAdd

test('add inserts a new line with a correct lineTotal', () => {
  const out = optimisticAdd([], product('cabc12345678', 34900), 2);
  assert.equal(out.length, 1);
  assert.equal(out[0].productId, 'cabc12345678');
  assert.equal(out[0].quantity, 2);
  assert.deepEqual(out[0].lineTotal, { amount: 69800, currency: 'INR' });
});

test('add increments an existing line (mirrors POST /cart/items)', () => {
  const out = optimisticAdd([line('cabc12345678', 34900, 2)], product('cabc12345678', 34900), 3);
  assert.equal(out.length, 1);
  assert.equal(out[0].quantity, 5);
  assert.equal(out[0].lineTotal.amount, 34900 * 5);
});

test('add clamps the merged quantity to MAX_PER_LINE', () => {
  const out = optimisticAdd([line('cabc12345678', 100, 19)], product('cabc12345678', 100), 5);
  assert.equal(out[0].quantity, MAX_PER_LINE);
  assert.equal(out[0].lineTotal.amount, 100 * MAX_PER_LINE);
});

// ----------------------------------------------------- optimisticSetQuantity

test('setQuantity writes an absolute value + recomputes the total', () => {
  const out = optimisticSetQuantity([line('cabc12345678', 100, 2)], 'cabc12345678', 7);
  assert.equal(out[0].quantity, 7);
  assert.equal(out[0].lineTotal.amount, 700);
});

test('setQuantity to 0 removes the line (mirrors PUT quantity:0 → delete)', () => {
  const out = optimisticSetQuantity([line('a1234567', 100, 2), line('b1234567', 200, 1)], 'a1234567', 0);
  assert.deepEqual(
    out.map((l) => l.productId),
    ['b1234567'],
  );
});

test('setQuantity clamps to MAX_PER_LINE', () => {
  const out = optimisticSetQuantity([line('a1234567', 100, 2)], 'a1234567', 999);
  assert.equal(out[0].quantity, MAX_PER_LINE);
});

// ----------------------------------------------------------- derived getters

test('subtotal and itemCount sum across lines', () => {
  const lines = [line('a1234567', 34900, 2), line('b1234567', 19900, 1)];
  assert.equal(subtotalOf(lines).amount, 34900 * 2 + 19900);
  assert.equal(itemCountOf(lines), 3);
});

// --------------------------------------------------------- migration planner

test('migration clears a pre-existing cart on first Option-A load + notifies', () => {
  const plan = planCartMigration(false, [line('p_acne_facewash', 34900, 1)]);
  assert.equal(plan.clear, true);
  assert.ok(plan.notice && plan.notice.length > 0);
});

test('migration is a no-op for a brand-new (empty) cart', () => {
  const plan = planCartMigration(false, []);
  assert.equal(plan.clear, false);
  assert.equal(plan.notice, null);
});

test('migration never re-fires once migrated', () => {
  const plan = planCartMigration(true, [line('a1234567', 100, 3)]);
  assert.equal(plan.clear, false);
  assert.equal(plan.notice, null);
});
