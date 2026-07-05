import test from 'node:test';
import assert from 'node:assert/strict';
import { isLowStock } from './inventory-flags';

test('isLowStock: at or below the threshold for tracked products', () => {
  assert.equal(isLowStock({ stockQty: 3, lowStockThreshold: 5, trackInventory: true }), true);
  assert.equal(isLowStock({ stockQty: 5, lowStockThreshold: 5, trackInventory: true }), true); // inclusive
  assert.equal(isLowStock({ stockQty: 6, lowStockThreshold: 5, trackInventory: true }), false);
  assert.equal(isLowStock({ stockQty: 0, lowStockThreshold: 5, trackInventory: true }), true);
});

test('isLowStock: untracked products are never low', () => {
  assert.equal(isLowStock({ stockQty: 0, lowStockThreshold: 5, trackInventory: false }), false);
});
