import test from 'node:test';
import assert from 'node:assert/strict';
import {
  paymentBadge,
  canCancelOrderStatus,
  canRefundOrderStatus,
  refundGate,
  canDownloadInvoice,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
} from './order-badges';
import type { OrderStatus } from '@/types/order';

const ALL_STATUSES: OrderStatus[] = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

test('COD orders always show a COD badge regardless of paymentStatus (never blank)', () => {
  assert.deepEqual(paymentBadge({ paymentMethod: 'COD', paymentStatus: null }), {
    label: 'COD',
    tone: 'neutral',
  });
  assert.deepEqual(paymentBadge({ paymentMethod: 'COD', paymentStatus: 'SUCCESS' }), {
    label: 'COD',
    tone: 'neutral',
  });
});

test('prepaid payment badge derives from paymentStatus', () => {
  assert.deepEqual(paymentBadge({ paymentMethod: 'PREPAID', paymentStatus: 'SUCCESS' }), {
    label: 'Paid',
    tone: 'success',
  });
  assert.deepEqual(paymentBadge({ paymentMethod: 'PREPAID', paymentStatus: 'INITIATED' }), {
    label: 'Pending',
    tone: 'warning',
  });
  assert.deepEqual(paymentBadge({ paymentMethod: 'PREPAID', paymentStatus: 'FAILED' }), {
    label: 'Failed',
    tone: 'danger',
  });
  assert.deepEqual(paymentBadge({ paymentMethod: 'PREPAID', paymentStatus: 'REFUNDED' }), {
    label: 'Refunded',
    tone: 'info',
  });
});

test('a prepaid order with no payment row yet shows Unpaid, never blank', () => {
  const b = paymentBadge({ paymentMethod: 'PREPAID', paymentStatus: null });
  assert.equal(b.label, 'Unpaid');
  assert.ok(b.tone);
});

test('canCancelOrderStatus matches the pre-shipment states', () => {
  for (const s of ['PENDING', 'PAID', 'PROCESSING'] as const) {
    assert.equal(canCancelOrderStatus(s), true);
  }
  for (const s of ['SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const) {
    assert.equal(canCancelOrderStatus(s), false);
  }
});

test('every OrderStatus has a label and a tone', () => {
  for (const s of ALL_STATUSES) {
    assert.ok(ORDER_STATUS_LABEL[s], `label for ${s}`);
    assert.ok(ORDER_STATUS_TONE[s], `tone for ${s}`);
  }
});

test('canRefundOrderStatus mirrors the backend REFUNDABLE_STATUSES', () => {
  for (const s of ['SHIPPED', 'DELIVERED', 'CANCELLED'] as const) {
    assert.equal(canRefundOrderStatus(s), true);
  }
  for (const s of ['PENDING', 'PAID', 'PROCESSING', 'REFUNDED'] as const) {
    assert.equal(canRefundOrderStatus(s), false);
  }
});

test('refundGate requires a refundable status AND the ADMIN role', () => {
  assert.equal(refundGate({ status: 'DELIVERED' }, 'ADMIN').allowed, true);
  const mgr = refundGate({ status: 'DELIVERED' }, 'MANAGER');
  assert.equal(mgr.allowed, false);
  assert.match(mgr.reason!, /ADMIN-only/i);
  const bad = refundGate({ status: 'PENDING' }, 'ADMIN');
  assert.equal(bad.allowed, false);
  assert.match(bad.reason!, /cannot be refunded/i);
});

test('canDownloadInvoice: COD from PROCESSING, prepaid from PAID; never PENDING/CANCELLED', () => {
  assert.equal(canDownloadInvoice('PROCESSING', 'COD'), true);
  assert.equal(canDownloadInvoice('PAID', 'PREPAID'), true);
  assert.equal(canDownloadInvoice('PAID', 'COD'), false);
  assert.equal(canDownloadInvoice('PENDING', 'PREPAID'), false);
  assert.equal(canDownloadInvoice('CANCELLED', 'COD'), false);
  assert.equal(canDownloadInvoice('DELIVERED', 'COD'), true);
});
