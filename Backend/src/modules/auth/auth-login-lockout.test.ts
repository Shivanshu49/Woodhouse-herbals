/**
 * End-to-end proof of the M1 fix: the login lockout must be attacker-scoped,
 * not victim-scoped. An unauthenticated attacker submitting wrong passwords
 * for a known email must NOT be able to lock the real owner out of their own
 * account, and the correct password must keep working.
 *
 * Run: npx tsx --test src/modules/auth/auth-login-lockout.test.ts
 */

import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JwtService } from '@nestjs/jwt';
import { resetEnvCacheForTests } from '../../common/config/env';
import { hashPassword } from '../../common/utils/passwords';
import { AuthService } from './auth.service';

const CORRECT = 'CorrectHorse9!battery';
let correctHash: string;

before(async () => {
  correctHash = await hashPassword(CORRECT);
});

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://x:x@localhost:5432/x';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(64);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(64);
  process.env.AUTH_MAX_FAILED_ATTEMPTS = '3';
  process.env.AUTH_LOCKOUT_MINUTES = '30';
  resetEnvCacheForTests();
});

function makeService() {
  const user = {
    id: 'u1',
    email: 'victim@example.com',
    fullName: 'Victim',
    role: 'CUSTOMER' as const,
    passwordHash: correctHash,
    emailVerified: true,
    deletedAt: null as Date | null,
    failedLoginAttempts: 0,
    lockedUntil: null as Date | null,
  };
  const prisma = {
    user: {
      findUnique: async ({ where }: any) =>
        where.email === user.email ? { ...user } : null,
      update: async ({ data, select }: any) => {
        if (data.failedLoginAttempts?.increment)
          user.failedLoginAttempts += data.failedLoginAttempts.increment;
        if (typeof data.failedLoginAttempts === 'number')
          user.failedLoginAttempts = data.failedLoginAttempts;
        if ('lockedUntil' in data) user.lockedUntil = data.lockedUntil;
        return select ? { failedLoginAttempts: user.failedLoginAttempts } : { ...user };
      },
    },
    refreshToken: { create: async () => ({}) },
    cart: { updateMany: async () => ({ count: 0 }) },
  };
  const events = { record: async () => {}, recentFailuresForIp: async () => 0 };
  const svc = new AuthService(
    prisma as any,
    new JwtService({}),
    {} as any,
    {} as any,
    events as any,
  );
  return { svc, user };
}

test('a failure-counter database error cannot turn wrong credentials into a 500', async () => {
  const { svc } = makeService();
  const prisma = (svc as any).prisma;
  prisma.user.update = async () => {
    throw new Error('database counter write failed');
  };

  await assert.rejects(
    svc.login(
      { email: 'victim@example.com', password: 'DefinitelyWrong9!' },
      { ip: '192.0.2.99' },
    ),
    (err: any) => typeof err?.getStatus === 'function' && err.getStatus() === 401,
  );
});

test('an attacker cannot lock the victim out: wrong passwords from the attacker IP leave the victim able to log in from their own IP', async () => {
  const { svc } = makeService();
  const attackerIp = '203.0.113.7';
  const victimIp = '198.51.100.9';

  // Attacker sprays wrong passwords well past the threshold, from their own IP.
  for (let i = 0; i < 5; i++) {
    await assert.rejects(
      svc.login({ email: 'victim@example.com', password: `wrong-${i}` }, { ip: attackerIp }),
    );
  }

  // The real owner logs in with the CORRECT password from THEIR OWN IP.
  const res: any = await svc.login(
    { email: 'victim@example.com', password: CORRECT },
    { ip: victimIp },
  );
  assert.ok(res.tokens?.accessToken, 'victim receives an access token');
  assert.equal(res.user.email, 'victim@example.com');
});

test('the correct password still works after a few failed attempts from the same IP', async () => {
  const { svc } = makeService();
  const ip = '192.0.2.50';
  await assert.rejects(svc.login({ email: 'victim@example.com', password: 'typo1' }, { ip }));
  await assert.rejects(svc.login({ email: 'victim@example.com', password: 'typo2' }, { ip }));

  const res: any = await svc.login({ email: 'victim@example.com', password: CORRECT }, { ip });
  assert.ok(res.tokens?.accessToken, 'a couple of typos do not block the correct password');
});

test('a spraying IP is gated at the door with 429 before any password check', async () => {
  const { svc } = makeService();
  const ip = '203.0.113.200';
  // Four failures pushes this IP one past the free allowance of 3.
  for (let i = 0; i < 4; i++) {
    await assert.rejects(svc.login({ email: 'victim@example.com', password: `x${i}` }, { ip }));
  }
  // The next attempt — even with the correct password — is throttled (429),
  // NOT answered with an account-lock message that would leak account state.
  await assert.rejects(
    svc.login({ email: 'victim@example.com', password: CORRECT }, { ip }),
    (e: any) => typeof e.getStatus === 'function' && e.getStatus() === 429,
  );
});
