import test from 'node:test';
import assert from 'node:assert/strict';
import { couponStatus } from './coupon-status';

const now = new Date('2026-07-06T12:00:00.000Z');
const base = { active: true, startsAt: null, expiresAt: null, maxUses: null, usedCount: 0 };

test('an all-clear active coupon is "active"', () => {
  assert.equal(couponStatus({ ...base }, now), 'active');
});

test('inactive dominates everything else', () => {
  // Even if it would otherwise be expired/scheduled/exhausted, inactive wins.
  assert.equal(
    couponStatus({ ...base, active: false, expiresAt: new Date('2020-01-01') }, now),
    'inactive',
  );
});

test('expired when expiresAt is strictly before now (matches preview semantics)', () => {
  assert.equal(couponStatus({ ...base, expiresAt: new Date('2026-07-06T11:59:59Z') }, now), 'expired');
  // Exactly now is NOT expired (preview uses `expiresAt < now`).
  assert.equal(couponStatus({ ...base, expiresAt: now }, now), 'active');
});

test('scheduled when startsAt is strictly after now', () => {
  assert.equal(couponStatus({ ...base, startsAt: new Date('2026-07-06T12:00:01Z') }, now), 'scheduled');
  assert.equal(couponStatus({ ...base, startsAt: now }, now), 'active');
});

test('exhausted when usedCount has reached maxUses', () => {
  assert.equal(couponStatus({ ...base, maxUses: 5, usedCount: 5 }, now), 'exhausted');
  assert.equal(couponStatus({ ...base, maxUses: 5, usedCount: 4 }, now), 'active');
  // Unlimited (maxUses null) is never exhausted.
  assert.equal(couponStatus({ ...base, maxUses: null, usedCount: 9999 }, now), 'active');
});

test('expired outranks scheduled and exhausted', () => {
  assert.equal(
    couponStatus(
      { active: true, startsAt: new Date('2027-01-01'), expiresAt: new Date('2020-01-01'), maxUses: 1, usedCount: 1 },
      now,
    ),
    'expired',
  );
});
