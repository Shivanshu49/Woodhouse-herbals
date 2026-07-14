/**
 * L6 — the access-token verify path must pin the HMAC algorithm to HS256, so a
 * token forged with a different `alg` (e.g. HS384, or a future asymmetric key
 * confusion) is rejected rather than accepted just because the HMAC secret
 * validates it.
 *
 * Run: npx tsx --test src/common/auth/jwt-auth.guard.test.ts
 */

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { env, resetEnvCacheForTests } from '../config/env';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ACCESS_COOKIE } from './auth-types';

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://x:x@localhost:5432/x';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(64);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(64);
  resetEnvCacheForTests();
});

const dummyHandler = () => undefined;
class DummyClass {}

function ctxWithCookie(token: string): ExecutionContext {
  const req: any = { cookies: { [ACCESS_COOKIE]: token } };
  return {
    getHandler: () => dummyHandler,
    getClass: () => DummyClass,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

test('JwtAuthGuard rejects an access token signed with a non-HS256 algorithm (alg pinned)', async () => {
  const jwt = new JwtService({});
  const token = await jwt.signAsync(
    { sub: 'u1', email: 'e@x', role: 'CUSTOMER', jti: 'j1', kind: 'access' },
    { secret: env.JWT_ACCESS_SECRET, algorithm: 'HS384' },
  );
  const guard = new JwtAuthGuard(new Reflector(), jwt);
  await assert.rejects(
    guard.canActivate(ctxWithCookie(token)),
    /Invalid or expired authentication/,
  );
});

test('JwtAuthGuard accepts a valid HS256 access token', async () => {
  const jwt = new JwtService({});
  const token = await jwt.signAsync(
    { sub: 'u1', email: 'e@x', role: 'CUSTOMER', jti: 'j1', kind: 'access' },
    { secret: env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: 900 },
  );
  const guard = new JwtAuthGuard(new Reflector(), jwt);
  assert.equal(await guard.canActivate(ctxWithCookie(token)), true);
});
