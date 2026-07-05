import test from 'node:test';
import assert from 'node:assert/strict';
import { GstRate, OrderStatus, PaymentMethod } from '@prisma/client';
import { gstRatePercent, isInvoiceable } from './gst-rate';

test('gstRatePercent maps every GstRate to its integer percent', () => {
  assert.equal(gstRatePercent(GstRate.EXEMPT), 0);
  assert.equal(gstRatePercent(GstRate.GST_5), 5);
  assert.equal(gstRatePercent(GstRate.GST_12), 12);
  assert.equal(gstRatePercent(GstRate.GST_18), 18);
  assert.equal(gstRatePercent(GstRate.GST_28), 28);
});

test('isInvoiceable: COD from PROCESSING, PREPAID from PAID; never PENDING/CANCELLED', () => {
  for (const s of ['PROCESSING', 'SHIPPED', 'DELIVERED', 'REFUNDED'] as const) {
    assert.equal(isInvoiceable(s, PaymentMethod.COD), true);
    assert.equal(isInvoiceable(s, PaymentMethod.PREPAID), true);
  }
  assert.equal(isInvoiceable(OrderStatus.PAID, PaymentMethod.PREPAID), true);
  assert.equal(isInvoiceable(OrderStatus.PAID, PaymentMethod.COD), false); // COD has no PAID pre-ship
  for (const m of [PaymentMethod.COD, PaymentMethod.PREPAID]) {
    assert.equal(isInvoiceable(OrderStatus.PENDING, m), false);
    assert.equal(isInvoiceable(OrderStatus.CANCELLED, m), false);
  }
});
