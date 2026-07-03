/**
 * Pure unit tests for password-reset URL routing. No Prisma, no IO, no env.
 * Run this file alone: npx tsx --test src/modules/auth/reset-url.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordResetUrl } from './reset-url';

const WEB = 'https://woodhouseherbals.com,https://admin.woodhouseherbals.com';

test('customers get the storefront reset page (first WEB_ORIGIN entry)', () => {
  assert.equal(
    passwordResetUrl('CUSTOMER', 'tok', WEB, 'https://admin.woodhouseherbals.com'),
    'https://woodhouseherbals.com/account/reset?token=tok',
  );
});

test('staff/manager/admin get the admin reset page when ADMIN_ORIGIN is set', () => {
  for (const role of ['STAFF', 'MANAGER', 'ADMIN'] as const) {
    assert.equal(
      passwordResetUrl(role, 'tok', WEB, 'https://admin.woodhouseherbals.com'),
      'https://admin.woodhouseherbals.com/reset?token=tok',
    );
  }
});

test('staff fall back to the storefront page when ADMIN_ORIGIN is unset', () => {
  assert.equal(
    passwordResetUrl('ADMIN', 'tok', WEB, undefined),
    'https://woodhouseherbals.com/account/reset?token=tok',
  );
});

test('token is URL-encoded and trailing slashes are trimmed', () => {
  assert.equal(
    passwordResetUrl('ADMIN', 'a+b/c', WEB, 'http://localhost:3001/'),
    'http://localhost:3001/reset?token=a%2Bb%2Fc',
  );
});
