import test from 'node:test';
import assert from 'node:assert/strict';
import { relativeTime, absoluteTime } from './order-date';

const now = new Date('2026-07-05T12:00:00.000Z').getTime();

test('under 45s reads "just now"', () => {
  assert.equal(relativeTime('2026-07-05T11:59:30.000Z', now), 'just now');
});

test('minutes', () => {
  assert.equal(relativeTime('2026-07-05T11:30:00.000Z', now), '30m ago');
});

test('hours', () => {
  assert.equal(relativeTime('2026-07-05T09:00:00.000Z', now), '3h ago');
});

test('days', () => {
  assert.equal(relativeTime('2026-07-02T12:00:00.000Z', now), '3d ago');
});

test('weeks', () => {
  assert.equal(relativeTime('2026-06-21T12:00:00.000Z', now), '2w ago');
});

test('absoluteTime returns a non-empty formatted string', () => {
  assert.ok(absoluteTime('2026-07-05T11:30:00.000Z').length > 0);
});
