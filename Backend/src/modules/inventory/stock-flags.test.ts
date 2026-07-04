import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StockStatus } from '@prisma/client';
import { stockFlagsFor } from './stock-flags';

test('stockFlagsFor: a positive quantity is in stock', () => {
  assert.deepEqual(stockFlagsFor(10), { inStock: true, stockStatus: StockStatus.IN_STOCK });
});

test('stockFlagsFor: exactly one unit is still in stock', () => {
  assert.deepEqual(stockFlagsFor(1), { inStock: true, stockStatus: StockStatus.IN_STOCK });
});

test('stockFlagsFor: zero quantity is out of stock', () => {
  assert.deepEqual(stockFlagsFor(0), { inStock: false, stockStatus: StockStatus.OUT_OF_STOCK });
});

test('stockFlagsFor: a negative quantity (defensive) is out of stock', () => {
  assert.deepEqual(stockFlagsFor(-3), { inStock: false, stockStatus: StockStatus.OUT_OF_STOCK });
});
