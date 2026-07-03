/**
 * Pure unit tests for the admin product list where-builder. No Prisma
 * client, no IO — `Prisma.ProductWhereInput` is a type-only import.
 * Run this file alone: npx tsx --test src/modules/admin-products/admin-product-where.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminProductWhere } from './admin-product-where';

test('defaults to active (non-deleted) rows', () => {
  const where = buildAdminProductWhere({});
  assert.deepEqual(where.deletedAt, null);
});

test('deleted: true shows only archived rows', () => {
  const where = buildAdminProductWhere({ deleted: true });
  assert.deepEqual(where.deletedAt, { not: null });
});

test('deleted: false (explicit) still filters to active rows', () => {
  const where = buildAdminProductWhere({ deleted: false });
  assert.deepEqual(where.deletedAt, null);
});

test('q builds an OR across name and sku, case-insensitive', () => {
  const where = buildAdminProductWhere({ q: 'vitamin' });
  assert.deepEqual(where.OR, [
    { name: { contains: 'vitamin', mode: 'insensitive' } },
    { sku: { contains: 'vitamin', mode: 'insensitive' } },
  ]);
});

test('no q means no OR clause', () => {
  const where = buildAdminProductWhere({});
  assert.equal(where.OR, undefined);
});

test('status filters by exact enum value', () => {
  const where = buildAdminProductWhere({ status: 'DRAFT' });
  assert.equal(where.status, 'DRAFT');
});

test('category filters by exact enum value', () => {
  const where = buildAdminProductWhere({ category: 'SERUM' });
  assert.equal(where.category, 'SERUM');
});

test('stock: out means stockQty <= 0', () => {
  const where = buildAdminProductWhere({ stock: 'out' });
  assert.deepEqual(where.stockQty, { lte: 0 });
});

test('stock: in means stockQty > 0', () => {
  const where = buildAdminProductWhere({ stock: 'in' });
  assert.deepEqual(where.stockQty, { gt: 0 });
});

test('stock: low means 0 < stockQty <= 5 (the default low-stock bucket)', () => {
  const where = buildAdminProductWhere({ stock: 'low' });
  assert.deepEqual(where.stockQty, { gt: 0, lte: 5 });
});

test('no stock filter leaves stockQty untouched', () => {
  const where = buildAdminProductWhere({});
  assert.equal(where.stockQty, undefined);
});

test('priceMin/priceMax convert rupees to paise (x100)', () => {
  const where = buildAdminProductWhere({ priceMin: 100, priceMax: 500 });
  assert.deepEqual(where.priceMinor, { gte: 10000, lte: 50000 });
});

test('priceMin alone only sets gte', () => {
  const where = buildAdminProductWhere({ priceMin: 100 });
  assert.deepEqual(where.priceMinor, { gte: 10000 });
});

test('priceMax alone only sets lte', () => {
  const where = buildAdminProductWhere({ priceMax: 500 });
  assert.deepEqual(where.priceMinor, { lte: 50000 });
});

test('combines deleted, q, status, category, stock, and price together', () => {
  const where = buildAdminProductWhere({
    deleted: true,
    q: 'serum',
    status: 'PUBLISHED',
    category: 'SERUM',
    stock: 'in',
    priceMin: 200,
    priceMax: 900,
  });
  assert.deepEqual(where, {
    deletedAt: { not: null },
    OR: [
      { name: { contains: 'serum', mode: 'insensitive' } },
      { sku: { contains: 'serum', mode: 'insensitive' } },
    ],
    status: 'PUBLISHED',
    category: 'SERUM',
    stockQty: { gt: 0 },
    priceMinor: { gte: 20000, lte: 90000 },
  });
});
