/**
 * Pure unit tests for the API client's refresh-decision logic. No network.
 * Run this file alone: npx tsx --test src/lib/api.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldAttemptRefresh } from './api';

test('a 401 on a normal call triggers a refresh attempt', () => {
  assert.equal(shouldAttemptRefresh(401, '/admin/products'), true);
});

test('a 401 on the refresh call itself does NOT recurse', () => {
  assert.equal(shouldAttemptRefresh(401, '/auth/refresh'), false);
});

test('a 401 on login does NOT trigger a refresh (bad credentials, not stale token)', () => {
  assert.equal(shouldAttemptRefresh(401, '/auth/admin-login'), false);
});

test('non-401 statuses never trigger a refresh', () => {
  assert.equal(shouldAttemptRefresh(403, '/admin/products'), false);
  assert.equal(shouldAttemptRefresh(500, '/admin/products'), false);
  assert.equal(shouldAttemptRefresh(200, '/admin/products'), false);
});
