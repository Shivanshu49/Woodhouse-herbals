/** Run alone: npx tsx --test src/modules/admin-orders/admin-order-summary.test.ts */
import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { toOrderSummary } from './admin-order-summary';

const placedAt = new Date('2026-07-01T10:00:00.000Z');

test('maps a paid order row to a summary with derived payment status + item count', () => {
  const summary = toOrderSummary({
    id: 'o1',
    number: 'WH-1001',
    placedAt,
    status: OrderStatus.PAID,
    totalMinor: 129900,
    shippingFullName: 'Asha Rao',
    payments: [{ status: PaymentStatus.SUCCESS }],
    _count: { items: 3 },
  });
  assert.deepEqual(summary, {
    id: 'o1',
    number: 'WH-1001',
    placedAt,
    status: 'PAID',
    totalMinor: 129900,
    customerName: 'Asha Rao',
    paymentStatus: 'SUCCESS',
    itemCount: 3,
  });
});

test('an order with no payments has paymentStatus null (latest-payment rule)', () => {
  const summary = toOrderSummary({
    id: 'o2',
    number: 'WH-1002',
    placedAt,
    status: OrderStatus.PENDING,
    totalMinor: 5000,
    shippingFullName: 'Guest',
    payments: [],
    _count: { items: 1 },
  });
  assert.equal(summary.paymentStatus, null);
});
