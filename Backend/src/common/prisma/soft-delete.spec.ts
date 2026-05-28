/**
 * Unit tests for the soft-delete helpers. Pure functions, no IO.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { excludeDeleted, isDeleted, softDelete, withNotDeleted } from './soft-delete';

test('excludeDeleted: injects deletedAt: null on empty where', () => {
  const out = excludeDeleted({});
  assert.deepEqual(out, { deletedAt: null });
});

test('excludeDeleted: preserves existing predicates', () => {
  const out = excludeDeleted({ slug: 'vit-c' });
  assert.deepEqual(out, { slug: 'vit-c', deletedAt: null });
});

test('excludeDeleted: respects explicit deletedAt override', () => {
  // Admin endpoints can ask to include deleted rows.
  const where = { deletedAt: { not: null } };
  const out = excludeDeleted(where);
  assert.deepEqual(out, where);
});

test('excludeDeleted: accepts undefined and returns a soft-delete filter', () => {
  const out = excludeDeleted(undefined as unknown as Record<string, unknown>);
  assert.deepEqual(out, { deletedAt: null });
});

test('withNotDeleted: composes with AND clauses without dropping them', () => {
  const where = { AND: [{ category: 'SERUM' }] };
  const out = withNotDeleted(where);
  assert.deepEqual(out, { AND: [{ category: 'SERUM' }], deletedAt: null });
});

test('softDelete: returns a deletedAt timestamp', () => {
  const d = softDelete();
  assert.ok(d.deletedAt instanceof Date);
  // Should be "now-ish" — within 2 seconds.
  assert.ok(Math.abs(Date.now() - d.deletedAt.getTime()) < 2000);
});

test('isDeleted: true only for rows with a real deletedAt', () => {
  assert.equal(isDeleted({ deletedAt: null }), false);
  assert.equal(isDeleted({ deletedAt: undefined }), false);
  assert.equal(isDeleted({ deletedAt: new Date() }), true);
});
