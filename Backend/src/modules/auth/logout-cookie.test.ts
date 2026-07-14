/**
 * L8 — the refresh cookie (wh_rt) is set with path '/api/auth', so it must be
 * CLEARED with the same path. A clearCookie at path '/' does not match, leaving
 * the (now server-revoked) cookie in the browser after logout / change-password.
 *
 * Run: npx tsx --test src/modules/auth/logout-cookie.test.ts
 */

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetEnvCacheForTests } from '../../common/config/env';
import { AuthController } from './auth.controller';
import { REFRESH_COOKIE } from '../../common/auth/auth-types';

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://x:x@localhost:5432/x';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(64);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(64);
  resetEnvCacheForTests();
});

function harness() {
  const cleared: Array<{ name: string; opts: any }> = [];
  const req: any = { cookies: {}, headers: {}, socket: {} };
  const res: any = { clearCookie: (name: string, opts: any) => cleared.push({ name, opts }) };
  return { req, res, cleared };
}

test('logout deletes the refresh cookie using its set path /api/auth', async () => {
  const auth: any = { logout: async () => {} };
  const controller = new AuthController(auth);
  const { req, res, cleared } = harness();
  await controller.logout(req, res);
  const rt = cleared.find((c) => c.name === REFRESH_COOKIE);
  assert.ok(rt, 'refresh cookie must be cleared on logout');
  assert.equal(rt!.opts.path, '/api/auth', 'must match the path the cookie was set with');
});

test('change-password deletes the refresh cookie using its set path /api/auth', async () => {
  const auth: any = { changePassword: async () => {} };
  const controller = new AuthController(auth);
  const { req, res, cleared } = harness();
  await controller.changePassword(
    { currentPassword: 'x', newPassword: 'y' } as any,
    { sub: 'u1' } as any,
    req,
    res,
  );
  const rt = cleared.find((c) => c.name === REFRESH_COOKIE);
  assert.ok(rt, 'refresh cookie must be cleared on change-password');
  assert.equal(rt!.opts.path, '/api/auth');
});
