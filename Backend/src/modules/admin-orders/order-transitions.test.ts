/**
 * Pure unit tests for the admin cancel guard (spec §2.1). No Prisma client, no IO.
 * Run alone: npx tsx --test src/modules/admin-orders/order-transitions.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderStatus } from '@prisma/client';
import { canCancel, assertCancellable, CANCELLABLE_STATUSES } from './order-transitions';

test('pre-shipment statuses are cancellable', () => {
  assert.equal(canCancel(OrderStatus.PENDING), true);
  assert.equal(canCancel(OrderStatus.PAID), true);
  assert.equal(canCancel(OrderStatus.PROCESSING), true);
});

test('shipped-and-beyond and terminal statuses are not cancellable', () => {
  assert.equal(canCancel(OrderStatus.SHIPPED), false);
  assert.equal(canCancel(OrderStatus.DELIVERED), false);
  assert.equal(canCancel(OrderStatus.CANCELLED), false);
  assert.equal(canCancel(OrderStatus.REFUNDED), false);
});

test('CANCELLABLE_STATUSES is exactly the three pre-shipment states', () => {
  assert.deepEqual([...CANCELLABLE_STATUSES].sort(), ['PAID', 'PENDING', 'PROCESSING']);
});

test('assertCancellable throws for SHIPPED', () => {
  assert.throws(() => assertCancellable(OrderStatus.SHIPPED), /Cannot cancel/);
});

test('assertCancellable is silent for PAID', () => {
  assert.doesNotThrow(() => assertCancellable(OrderStatus.PAID));
});
