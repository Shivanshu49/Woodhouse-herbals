/**
 * Pure unit tests for login error mapping. No network, no React.
 * Run this file alone: npx tsx --test src/lib/auth-errors.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from './api';
import { loginErrorMessage } from './auth-errors';

test('401 is the generic credentials message (no enumeration)', () => {
  assert.equal(
    loginErrorMessage(new ApiError(401, 'Invalid email or password')),
    'Invalid email or password.',
  );
});

test('403 surfaces the backend message (lockout / unverified are actionable)', () => {
  assert.equal(
    loginErrorMessage(new ApiError(403, 'Account temporarily locked. Try again later.')),
    'Account temporarily locked. Try again later.',
  );
  assert.equal(
    loginErrorMessage(new ApiError(403, 'Please verify your email address. We sent you a fresh link.')),
    'Please verify your email address. We sent you a fresh link.',
  );
});

test('423 Locked is treated like 403', () => {
  assert.equal(
    loginErrorMessage(new ApiError(423, 'Account locked')),
    'Account locked',
  );
});

test('429 is a distinct rate-limit message, not "invalid credentials"', () => {
  const msg = loginErrorMessage(new ApiError(429, 'ThrottlerException: Too Many Requests'));
  assert.match(msg, /too many attempts/i);
  assert.doesNotMatch(msg, /invalid email or password/i);
});

test('5xx is a server-problem message, not "invalid credentials"', () => {
  const msg = loginErrorMessage(new ApiError(500, 'Internal Server Error'));
  assert.match(msg, /server ran into a problem/i);
  assert.doesNotMatch(msg, /invalid email or password/i);
});

test('a thrown non-ApiError (network failure) is a connectivity message', () => {
  const msg = loginErrorMessage(new TypeError('Failed to fetch'));
  assert.match(msg, /reach the server/i);
});
