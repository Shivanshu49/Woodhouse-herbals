/**
 * Pure unit tests for coupon discount math. No Prisma, no IO.
 * Run with: `npx tsx --test src/modules/coupons/coupon-pricing.spec.ts`
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CouponKind } from '@prisma/client';
import { computeDiscount, type CouponPolicy } from './coupon-pricing';

const percent20 = (over: { min?: number; cap?: number | null } = {}): CouponPolicy => ({
  kind: CouponKind.PERCENT,
  value: 20,
  maxDiscountMinor: over.cap ?? null,
  minCartMinor: over.min ?? 0,
});

const flat100 = (over: { min?: number } = {}): CouponPolicy => ({
  kind: CouponKind.FLAT,
  value: 10000, // ₹100
  maxDiscountMinor: null,
  minCartMinor: over.min ?? 0,
});

test('PERCENT discount: 20% off ₹500 = ₹100', () => {
  const r = computeDiscount(percent20(), { subtotalMinor: 50000, applicableSubtotalMinor: 50000 });
  assert.equal(r.ok, true);
  assert.equal(r.discountMinor, 10000);
});

test('PERCENT discount honours maxDiscountMinor cap', () => {
  // 20% of ₹10,000 = ₹2,000; cap of ₹500 should clamp.
  const r = computeDiscount(percent20({ cap: 50000 }), {
    subtotalMinor: 1_000_000,
    applicableSubtotalMinor: 1_000_000,
  });
  assert.equal(r.ok, true);
  assert.equal(r.discountMinor, 50000);
});

test('PERCENT discount applies only to applicable subtotal', () => {
  // Cart is ₹1000 but only ₹400 qualifies. 20% × 400 = 80.
  const r = computeDiscount(percent20(), { subtotalMinor: 100000, applicableSubtotalMinor: 40000 });
  assert.equal(r.ok, true);
  assert.equal(r.discountMinor, 8000);
});

test('FLAT discount: ₹100 off ₹500 = ₹100', () => {
  const r = computeDiscount(flat100(), { subtotalMinor: 50000, applicableSubtotalMinor: 50000 });
  assert.equal(r.ok, true);
  assert.equal(r.discountMinor, 10000);
});

test('FLAT discount cannot exceed applicable subtotal (no negative totals)', () => {
  // ₹100 flat on a ₹40 applicable bucket — discount capped at ₹40.
  const r = computeDiscount(flat100(), { subtotalMinor: 4000, applicableSubtotalMinor: 4000 });
  assert.equal(r.discountMinor, 4000);
});

test('rejects when below minCartMinor', () => {
  const r = computeDiscount(percent20({ min: 50000 }), {
    subtotalMinor: 40000,
    applicableSubtotalMinor: 40000,
  });
  assert.equal(r.ok, false);
  assert.match(r.reason ?? '', /minimum/i);
  assert.equal(r.discountMinor, 0);
});

test('rejects when nothing in cart applies', () => {
  const r = computeDiscount(percent20(), { subtotalMinor: 50000, applicableSubtotalMinor: 0 });
  assert.equal(r.ok, false);
  assert.equal(r.discountMinor, 0);
});

test('PERCENT with invalid value (0 or >100) is rejected', () => {
  const bad = (v: number): CouponPolicy => ({ ...percent20(), value: v });
  for (const v of [0, -10, 101, 999]) {
    const r = computeDiscount(bad(v), { subtotalMinor: 50000, applicableSubtotalMinor: 50000 });
    assert.equal(r.ok, false, `value ${v} should be rejected`);
  }
});

test('PERCENT discount floors paise correctly (no rounding-up free money)', () => {
  // 33% off ₹1.01 = ₹0.3333 → must floor to 33 paise, not 34.
  const policy: CouponPolicy = {
    kind: CouponKind.PERCENT,
    value: 33,
    maxDiscountMinor: null,
    minCartMinor: 0,
  };
  const r = computeDiscount(policy, { subtotalMinor: 101, applicableSubtotalMinor: 101 });
  assert.equal(r.discountMinor, 33);
});
