/** Run alone: npx tsx --test src/modules/admin-orders/admin-order-summary.test.ts */
import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { toOrderSummary } from './admin-order-summary';

const placedAt = new Date('2026-07-01T10:00:00.000Z');

test('maps a paid prepaid order row to a full summary (payment status + method + item count)', () => {
  const summary = toOrderSummary({
    id: 'o1',
    number: 'WH-1001',
    placedAt,
    status: OrderStatus.PAID,
    paymentMethod: PaymentMethod.PREPAID,
    totalMinor: 129900,
    shippingFullName: 'Asha Rao',
    userId: 'u1',
    payments: [{ status: PaymentStatus.SUCCESS }],
    _count: { items: 3 },
  });
  assert.deepEqual(summary, {
    id: 'o1',
    number: 'WH-1001',
    placedAt,
    status: 'PAID',
    paymentMethod: 'PREPAID',
    totalMinor: 129900,
    customerName: 'Asha Rao',
    isGuest: false,
    paymentStatus: 'SUCCESS',
    itemCount: 3,
  });
});

test('a COD guest order (no user, no payments) → paymentMethod COD, isGuest true, paymentStatus null', () => {
  const summary = toOrderSummary({
    id: 'o2',
    number: 'WH-1002',
    placedAt,
    status: OrderStatus.PENDING,
    paymentMethod: PaymentMethod.COD,
    totalMinor: 5000,
    shippingFullName: 'Ravi Kumar',
    userId: null,
    payments: [],
    _count: { items: 1 },
  });
  assert.equal(summary.paymentMethod, 'COD');
  assert.equal(summary.isGuest, true);
  assert.equal(summary.paymentStatus, null);
  assert.equal(summary.customerName, 'Ravi Kumar');
});

test('blank shippingFullName falls back to Guest label', () => {
  const summary = toOrderSummary({
    id: 'o3', number: 'WH-1003', placedAt, status: OrderStatus.PENDING,
    paymentMethod: PaymentMethod.PREPAID, totalMinor: 100, shippingFullName: '  ',
    userId: null, payments: [], _count: { items: 1 },
  });
  assert.equal(summary.customerName, 'Guest');
});
