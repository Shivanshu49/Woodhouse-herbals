import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adjustStockInView, applyBulkToView, dropIdFromView } from './products-optimistic';
import type { AdminProductRow, AdminProductsList } from '@/types/product';

function row(id: string, over: Partial<AdminProductRow> = {}): AdminProductRow {
  return {
    id,
    name: `P${id}`,
    slug: `p${id}`,
    sku: `SKU${id}`,
    category: 'FACE_WASH',
    priceMinor: 10000,
    compareAtPriceMinor: null,
    stockQty: 50,
    inStock: true,
    status: 'PUBLISHED',
    featured: false,
    thumbnailUrl: '',
    thumbnailAlt: '',
    deletedAt: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function view(items: AdminProductRow[]): AdminProductsList {
  return { items, total: items.length, page: 1, perPage: 25 };
}

const NOW = '2026-07-04T00:00:00.000Z';

test('publish updates status and keeps rows in an unfiltered view', () => {
  const v = view([row('1', { status: 'DRAFT' }), row('2', { status: 'DRAFT' })]);
  const next = applyBulkToView(v, { ids: ['1'], action: 'publish' }, {}, NOW);
  assert.equal(next.items.find((r) => r.id === '1')?.status, 'PUBLISHED');
  assert.equal(next.items.length, 2);
  assert.equal(next.total, 2);
});

test('draft removes rows from a Published-filtered view and decrements total', () => {
  const v = view([row('1', { status: 'PUBLISHED' }), row('2', { status: 'PUBLISHED' })]);
  const next = applyBulkToView(v, { ids: ['1'], action: 'draft' }, { status: 'PUBLISHED' }, NOW);
  assert.deepEqual(
    next.items.map((r) => r.id),
    ['2'],
  );
  assert.equal(next.total, 1);
});

test('archive removes rows from a live view', () => {
  const v = view([row('1'), row('2')]);
  const next = applyBulkToView(v, { ids: ['1', '2'], action: 'archive' }, {}, NOW);
  assert.equal(next.items.length, 0);
  assert.equal(next.total, 0);
});

test('archive stamps deletedAt when the view is the archived view', () => {
  const v = view([row('1')]);
  const next = applyBulkToView(v, { ids: ['1'], action: 'archive' }, { deleted: true }, NOW);
  assert.equal(next.items[0]?.deletedAt, NOW);
  assert.equal(next.total, 1);
});

test('restore removes rows from an archived view', () => {
  const v = view([row('1', { deletedAt: NOW })]);
  const next = applyBulkToView(v, { ids: ['1'], action: 'restore' }, { deleted: true }, NOW);
  assert.equal(next.items.length, 0);
  assert.equal(next.total, 0);
});

test('set-category leaves the summary rows unchanged', () => {
  const v = view([row('1'), row('2')]);
  const next = applyBulkToView(
    v,
    { ids: ['1'], action: 'set-category', categoryId: 'c1' },
    {},
    NOW,
  );
  assert.equal(next.items.length, 2);
  assert.equal(next.total, 2);
});

test('dropIdFromView (delete) only affects live views', () => {
  const live = view([row('1'), row('2')]);
  assert.deepEqual(
    dropIdFromView(live, '1', false, {}).items.map((r) => r.id),
    ['2'],
  );
  // In an archived view a delete is a no-op.
  const archived = view([row('1'), row('2')]);
  assert.equal(dropIdFromView(archived, '1', false, { deleted: true }).items.length, 2);
});

test('dropIdFromView (restore) only affects archived views', () => {
  const archived = view([row('1'), row('2')]);
  assert.deepEqual(
    dropIdFromView(archived, '1', true, { deleted: true }).items.map((r) => r.id),
    ['2'],
  );
  const live = view([row('1'), row('2')]);
  assert.equal(dropIdFromView(live, '1', true, {}).items.length, 2);
});

test('adjustStockInView sets the new quantity and derives inStock (unfiltered view)', () => {
  const v = view([row('1', { stockQty: 5, inStock: true })]);
  const next = adjustStockInView(v, '1', 0, {});
  assert.equal(next.items[0]?.stockQty, 0);
  assert.equal(next.items[0]?.inStock, false);
  assert.equal(next.total, 1);
});

test('adjustStockInView drops a row that leaves the active stock bucket', () => {
  // "Out of stock" view; restocking to 40 must remove the row + decrement total.
  const v = view([row('1', { stockQty: 0, inStock: false }), row('2', { stockQty: 0 })]);
  const next = adjustStockInView(v, '1', 40, { stock: 'out' });
  assert.deepEqual(
    next.items.map((r) => r.id),
    ['2'],
  );
  assert.equal(next.total, 1);
});

test('adjustStockInView keeps a row that stays in the active stock bucket', () => {
  // "Low" bucket is 1–5; 5 → 3 stays low.
  const v = view([row('1', { stockQty: 5 })]);
  const next = adjustStockInView(v, '1', 3, { stock: 'low' });
  assert.equal(next.items[0]?.stockQty, 3);
  assert.equal(next.total, 1);
});
