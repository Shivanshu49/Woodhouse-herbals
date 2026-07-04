import test from 'node:test';
import assert from 'node:assert/strict';
import { ordersViewToParams, activeOrderFilterCount, DEFAULT_ORDERS_VIEW } from './order-meta';

test('default view produces minimal params (page/perPage/sort)', () => {
  const p = ordersViewToParams(DEFAULT_ORDERS_VIEW);
  assert.equal(p.q, undefined);
  assert.equal(p.status, undefined);
  assert.equal(p.paymentStatus, undefined);
  assert.equal(p.page, 1);
  assert.equal(p.perPage, 25);
});

test('statuses join into a comma list', () => {
  const p = ordersViewToParams({ ...DEFAULT_ORDERS_VIEW, statuses: ['PENDING', 'PAID'] });
  assert.equal(p.status, 'PENDING,PAID');
});

test('empty statuses omit the status param', () => {
  assert.equal(ordersViewToParams({ ...DEFAULT_ORDERS_VIEW, statuses: [] }).status, undefined);
});

test('trims q and omits when blank', () => {
  assert.equal(ordersViewToParams({ ...DEFAULT_ORDERS_VIEW, q: '  ' }).q, undefined);
  assert.equal(ordersViewToParams({ ...DEFAULT_ORDERS_VIEW, q: ' WH-1 ' }).q, 'WH-1');
});

test('passes payment + date filters through', () => {
  const p = ordersViewToParams({
    ...DEFAULT_ORDERS_VIEW,
    paymentStatus: 'SUCCESS',
    paymentMethod: 'COD',
    dateFrom: '2026-07-01',
    dateTo: '2026-07-04',
  });
  assert.equal(p.paymentStatus, 'SUCCESS');
  assert.equal(p.paymentMethod, 'COD');
  assert.equal(p.dateFrom, '2026-07-01');
  assert.equal(p.dateTo, '2026-07-04');
});

test('activeOrderFilterCount counts each active group once (q excluded)', () => {
  assert.equal(activeOrderFilterCount(DEFAULT_ORDERS_VIEW), 0);
  assert.equal(
    activeOrderFilterCount({
      ...DEFAULT_ORDERS_VIEW,
      q: 'ignored',
      statuses: ['PENDING', 'PAID'],
      paymentMethod: 'COD',
      dateFrom: '2026-07-01',
    }),
    3,
  );
});
