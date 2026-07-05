import test from 'node:test';
import assert from 'node:assert/strict';
import { nextSortOrder, dateWindowError, normalizePageSlug } from './content-helpers';

// ── nextSortOrder ─────────────────────────────────────────────────────
// New sortable rows (banners, offer-strip items, testimonials, faqs) append
// to the end: one past the current max. An empty table starts at 1.

test('nextSortOrder returns 1 when the table is empty (null/undefined max)', () => {
  assert.equal(nextSortOrder(null), 1);
  assert.equal(nextSortOrder(undefined), 1);
});

test('nextSortOrder returns max + 1', () => {
  assert.equal(nextSortOrder(0), 1);
  assert.equal(nextSortOrder(5), 6);
  assert.equal(nextSortOrder(42), 43);
});

// ── dateWindowError ───────────────────────────────────────────────────
// Banners and offer-strip items carry an optional [startsAt, endsAt] schedule
// window. We store it but the storefront doesn't enforce it yet (deferred).
// Still, an inverted window (end <= start) is a data-entry error worth rejecting.

test('dateWindowError allows an open-ended or absent window', () => {
  assert.equal(dateWindowError(null, null), null);
  assert.equal(dateWindowError(new Date('2026-01-01'), null), null);
  assert.equal(dateWindowError(null, new Date('2026-01-01')), null);
});

test('dateWindowError allows a forward window (start < end)', () => {
  assert.equal(
    dateWindowError(new Date('2026-01-01T00:00:00Z'), new Date('2026-02-01T00:00:00Z')),
    null,
  );
});

test('dateWindowError rejects an inverted or empty window (end <= start)', () => {
  const start = new Date('2026-02-01T00:00:00Z');
  const same = new Date('2026-02-01T00:00:00Z');
  const before = new Date('2026-01-01T00:00:00Z');
  assert.equal(typeof dateWindowError(start, before), 'string');
  assert.equal(typeof dateWindowError(start, same), 'string'); // equal instants = empty window
});

// ── normalizePageSlug ─────────────────────────────────────────────────
// Static pages are addressed by a URL-safe slug. Same rules as categories:
// lowercase, non-alphanumerics collapse to single hyphens, trimmed of edges.

test('normalizePageSlug lowercases, hyphenates, and trims', () => {
  assert.equal(normalizePageSlug('About Us'), 'about-us');
  assert.equal(normalizePageSlug('  Privacy Policy!!  '), 'privacy-policy');
  assert.equal(normalizePageSlug('Terms & Conditions'), 'terms-conditions');
  assert.equal(normalizePageSlug('already-good'), 'already-good');
});

test('normalizePageSlug collapses repeats and strips leading/trailing hyphens', () => {
  assert.equal(normalizePageSlug('--Shipping---Info--'), 'shipping-info');
  assert.equal(normalizePageSlug('!!!'), ''); // nothing slug-able → empty (caller rejects)
});
