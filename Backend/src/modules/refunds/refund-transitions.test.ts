/**
 * Pure unit tests for refund state logic (spec §2, §5). No Prisma client, no IO.
 * Run alone: npx tsx --test src/modules/refunds/refund-transitions.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderStatus, RefundDisposition } from '@prisma/client';
import {
  canRefundStatus,
  assertRefundable,
  deriveMerchantRefundId,
  mapRefundState,
  shouldRestock,
} from './refund-transitions';

test('refundable states are SHIPPED / DELIVERED / CANCELLED', () => {
  for (const s of ['SHIPPED', 'DELIVERED', 'CANCELLED'] as const) {
    assert.equal(canRefundStatus(s), true);
  }
  for (const s of ['PENDING', 'PAID', 'PROCESSING', 'REFUNDED'] as const) {
    assert.equal(canRefundStatus(s), false);
  }
});

test('assertRefundable throws for a non-refundable status, silent for a refundable one', () => {
  assert.throws(() => assertRefundable(OrderStatus.PROCESSING), /cannot be refunded|Cancel it first/i);
  assert.doesNotThrow(() => assertRefundable(OrderStatus.DELIVERED));
});

test('deriveMerchantRefundId is deterministic + PhonePe-safe (alnum, <=38 chars)', () => {
  const id = deriveMerchantRefundId('cmr6xyz0001abcd');
  assert.equal(id, deriveMerchantRefundId('cmr6xyz0001abcd'));
  assert.match(id, /^RF[A-Za-z0-9]+$/);
  assert.ok(id.length <= 38);
});

test('mapRefundState maps PhonePe states to a RefundStatus token', () => {
  assert.equal(mapRefundState('COMPLETED'), 'PROCESSED');
  assert.equal(mapRefundState('FAILED'), 'FAILED');
  assert.equal(mapRefundState('PENDING'), 'PENDING');
  assert.equal(mapRefundState('SOMETHING_ELSE'), 'PENDING'); // unknown → not terminal
});

test('shouldRestock only for RETURNED', () => {
  assert.equal(shouldRestock(RefundDisposition.RETURNED), true);
  assert.equal(shouldRestock(RefundDisposition.DAMAGED), false);
  assert.equal(shouldRestock(RefundDisposition.LOST), false);
});
