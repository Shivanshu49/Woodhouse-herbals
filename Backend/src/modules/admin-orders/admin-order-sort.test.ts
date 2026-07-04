/** Run alone: npx tsx --test src/modules/admin-orders/admin-order-sort.test.ts */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AdminOrderSort, buildAdminOrderOrderBy } from './admin-order-sort';

test('default / newest sorts by placedAt desc', () => {
  assert.deepEqual(buildAdminOrderOrderBy(), { placedAt: 'desc' });
  assert.deepEqual(buildAdminOrderOrderBy(AdminOrderSort.Newest), { placedAt: 'desc' });
});

test('oldest sorts by placedAt asc', () => {
  assert.deepEqual(buildAdminOrderOrderBy(AdminOrderSort.Oldest), { placedAt: 'asc' });
});

test('total_high / total_low sort by totalMinor', () => {
  assert.deepEqual(buildAdminOrderOrderBy(AdminOrderSort.TotalHigh), { totalMinor: 'desc' });
  assert.deepEqual(buildAdminOrderOrderBy(AdminOrderSort.TotalLow), { totalMinor: 'asc' });
});
