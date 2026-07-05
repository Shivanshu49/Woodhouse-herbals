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

test('mapRefundState treats a definitive rejection as FAILED (releases the payment)', () => {
  // HTTP 4xx hard reject (EXCESS_REFUND_AMOUNT / TXN_OLDER_THAN_LIMIT / NOT_FOUND).
  assert.equal(mapRefundState('PENDING', { httpStatus: 400, success: false }), 'FAILED');
  assert.equal(mapRefundState('SOMETHING_ELSE', { httpStatus: 404 }), 'FAILED');
  // 200 with an explicit success:false is still a rejection.
  assert.equal(mapRefundState('PENDING', { httpStatus: 200, success: false }), 'FAILED');
  // A terminal COMPLETED/FAILED always wins over the outcome.
  assert.equal(mapRefundState('COMPLETED', { httpStatus: 500 }), 'PROCESSED');
  assert.equal(mapRefundState('FAILED', { httpStatus: 200, success: true }), 'FAILED');
});

test('mapRefundState parks PENDING for transient/accepted responses (never guesses)', () => {
  assert.equal(mapRefundState('PENDING', { httpStatus: 500 }), 'PENDING'); // transient — recheck
  assert.equal(mapRefundState('PENDING', { httpStatus: 200, success: true }), 'PENDING'); // accepted-pending
  assert.equal(mapRefundState('WEIRD', { httpStatus: 200, success: true }), 'PENDING'); // unknown but accepted
});

test('shouldRestock only for RETURNED', () => {
  assert.equal(shouldRestock(RefundDisposition.RETURNED), true);
  assert.equal(shouldRestock(RefundDisposition.DAMAGED), false);
  assert.equal(shouldRestock(RefundDisposition.LOST), false);
});
