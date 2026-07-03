/**
 * Pure unit tests for role-aware refresh TTL. No Prisma, no IO.
 * Run this file alone: npx tsx --test src/modules/auth/token-ttl.test.ts
 */
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetEnvCacheForTests } from '../../common/config/env';
import { refreshTtlSecondsForRole } from './token-ttl';

beforeEach(() => {
  process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.JWT_REFRESH_TTL = '2592000';
  process.env.JWT_ADMIN_REFRESH_TTL = '3600';
  resetEnvCacheForTests();
});

test('customers keep the long refresh TTL', () => {
  assert.equal(refreshTtlSecondsForRole('CUSTOMER'), 2592000);
});

test('staff, manager, and admin get the short admin TTL', () => {
  assert.equal(refreshTtlSecondsForRole('STAFF'), 3600);
  assert.equal(refreshTtlSecondsForRole('MANAGER'), 3600);
  assert.equal(refreshTtlSecondsForRole('ADMIN'), 3600);
});

test('admin TTL follows the env override', () => {
  process.env.JWT_ADMIN_REFRESH_TTL = '1800';
  resetEnvCacheForTests();
  assert.equal(refreshTtlSecondsForRole('ADMIN'), 1800);
  assert.equal(refreshTtlSecondsForRole('CUSTOMER'), 2592000);
});
