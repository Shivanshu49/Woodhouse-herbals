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

test('deriveMerchantRefundId is deterministic + gateway-safe (alnum, <=38 chars)', () => {
  const id = deriveMerchantRefundId('cmr6xyz0001abcd');
  assert.equal(id, deriveMerchantRefundId('cmr6xyz0001abcd'));
  assert.match(id, /^RF[A-Za-z0-9]+$/);
  assert.ok(id.length <= 38);
});

// (The provider state→RefundStatus mapping moved to
// razorpay-states.ts::mapRazorpayRefundState with the gateway swap and is
// pinned in razorpay-states.test.ts — the legacy mapRefundState is gone.)

test('shouldRestock only for RETURNED', () => {
  assert.equal(shouldRestock(RefundDisposition.RETURNED), true);
  assert.equal(shouldRestock(RefundDisposition.DAMAGED), false);
  assert.equal(shouldRestock(RefundDisposition.LOST), false);
});
