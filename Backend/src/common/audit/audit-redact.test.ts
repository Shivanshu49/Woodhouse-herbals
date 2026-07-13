import test from 'node:test';
import assert from 'node:assert/strict';
import { redactSecrets } from './audit-redact';

test('Date values become ISO strings, not {} (the audit-timestamp regression)', () => {
  const d = new Date('2026-01-01T10:30:00.000Z');
  const out = redactSecrets({ createdAt: d, startsAt: d }) as Record<string, unknown>;
  assert.equal(out.createdAt, '2026-01-01T10:30:00.000Z');
  assert.equal(out.startsAt, '2026-01-01T10:30:00.000Z');
});

test('a bare Date round-trips to ISO', () => {
  assert.equal(redactSecrets(new Date('2026-03-15T00:00:00.000Z')), '2026-03-15T00:00:00.000Z');
});

test('secret-bearing keys are redacted (values, by key name)', () => {
  const out = redactSecrets({
    resetUrl: 'https://x/reset?token=abc',
    passwordHash: 'h',
    apiKey: 'k',
    name: 'Asha',
  }) as Record<string, unknown>;
  assert.equal(out.resetUrl, '[redacted]');
  assert.equal(out.passwordHash, '[redacted]');
  assert.equal(out.apiKey, '[redacted]');
  assert.equal(out.name, 'Asha'); // non-secret preserved
});

test('signature headers are redacted — the test that was never written for x-verify, now for Razorpay', () => {
  const out = redactSecrets({
    'x-razorpay-signature': 'deadbeef0123456789',
    razorpay_signature: 'abc',
    'X-Razorpay-Signature': 'CASED', // regex is case-insensitive
    orderNumber: 'WH-ABC123', // non-secret preserved
  }) as Record<string, unknown>;
  assert.equal(out['x-razorpay-signature'], '[redacted]');
  assert.equal(out.razorpay_signature, '[redacted]');
  assert.equal(out['X-Razorpay-Signature'], '[redacted]');
  assert.equal(out.orderNumber, 'WH-ABC123');
});

test('nested objects + arrays are walked, Dates inside preserved', () => {
  const out = redactSecrets({
    user: { fullName: 'A', token: 't', lastLogin: new Date('2026-02-02T00:00:00.000Z') },
    events: [{ at: new Date('2026-02-03T00:00:00.000Z'), secret: 's' }],
  }) as any;
  assert.equal(out.user.fullName, 'A');
  assert.equal(out.user.token, '[redacted]');
  assert.equal(out.user.lastLogin, '2026-02-02T00:00:00.000Z');
  assert.equal(out.events[0].at, '2026-02-03T00:00:00.000Z');
  assert.equal(out.events[0].secret, '[redacted]');
});

test('primitives pass through unchanged', () => {
  assert.equal(redactSecrets(42), 42);
  assert.equal(redactSecrets('hi'), 'hi');
  assert.equal(redactSecrets(null), null);
  assert.equal(redactSecrets(undefined), undefined);
});
