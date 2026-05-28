/**
 * Tests for the token utilities. Verify that tokens are sufficiently
 * random, that hashing is deterministic, and that constant-time compare
 * actually returns the right answer for equal/unequal hex strings.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { constantTimeEqualHex, generateOpaqueToken, hashToken } from './tokens';

test('generateOpaqueToken: 32 bytes → 43 base64url chars', () => {
  const t = generateOpaqueToken();
  assert.match(t, /^[A-Za-z0-9_-]+$/);
  assert.ok(t.length >= 40);
});

test('generateOpaqueToken: collisions are statistically impossible', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i += 1) seen.add(generateOpaqueToken());
  assert.equal(seen.size, 200, 'no collisions in 200 samples');
});

test('hashToken: deterministic, 64-char hex', () => {
  const a = hashToken('hello');
  const b = hashToken('hello');
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test('hashToken: distinct inputs produce distinct hashes', () => {
  assert.notEqual(hashToken('hello'), hashToken('hellp'));
});

test('constantTimeEqualHex: true on equal, false on unequal same-length', () => {
  const a = hashToken('a');
  const b = hashToken('b');
  assert.equal(constantTimeEqualHex(a, a), true);
  assert.equal(constantTimeEqualHex(a, b), false);
});

test('constantTimeEqualHex: false on length mismatch (no exception)', () => {
  assert.equal(constantTimeEqualHex('aaaa', 'aaaaa'), false);
});
