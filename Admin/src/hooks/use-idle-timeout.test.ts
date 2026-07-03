/**
 * Pure unit tests for the idle-timeout deadline math. No React, no timers.
 * Run this file alone: npx tsx --test src/hooks/use-idle-timeout.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextDeadline, THIRTY_MINUTES_MS } from './use-idle-timeout';

test('deadline is now + timeout', () => {
  assert.equal(nextDeadline(1_000, 5_000), 6_000);
});

test('the default admin idle window is 30 minutes', () => {
  assert.equal(THIRTY_MINUTES_MS, 30 * 60 * 1000);
});

test('activity later pushes the deadline out', () => {
  const first = nextDeadline(0, THIRTY_MINUTES_MS);
  const afterActivity = nextDeadline(60_000, THIRTY_MINUTES_MS);
  assert.ok(afterActivity > first);
});
