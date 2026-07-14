/**
 * M3 — account-enumeration oracles in the auth flows must be closed.
 *
 *  - Registration must return an IDENTICAL response whether or not the email
 *    already exists (the old 409-vs-201 status/body divergence was an oracle).
 *  - The password-reset request must not block on the email provider — awaiting
 *    the send only on the hit branch is a timing oracle for account existence.
 *
 * (The login-lockout oracle was removed with the account lock in M1.)
 *
 * Run: npx tsx --test src/modules/auth/auth-enumeration.test.ts
 */

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JwtService } from '@nestjs/jwt';
import { resetEnvCacheForTests } from '../../common/config/env';
import { AuthService } from './auth.service';

// Meets DEFAULT_PASSWORD_POLICY (>=10 chars, upper/lower/digit/symbol) and is
// not in the common-password blocklist.
const STRONG = 'Aa1!bbbbbbbb';

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://x:x@localhost:5432/x';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(64);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(64);
  process.env.WEB_ORIGIN = 'http://localhost:3000';
  delete process.env.RESEND_API_KEY;
  resetEnvCacheForTests();
});

function makeService(opts: { mailSend?: () => Promise<void> } = {}) {
  const users = new Map<string, any>();
  users.set('victim@example.com', {
    id: 'u1',
    email: 'victim@example.com',
    fullName: 'Victim',
    role: 'CUSTOMER',
    passwordHash: '$2a$12$' + 'x'.repeat(53),
    emailVerified: true,
    deletedAt: null,
  });
  const prisma = {
    user: {
      findUnique: async ({ where }: any) => users.get(where.email) ?? null,
      create: async ({ data, select }: any) => {
        const u = { id: 'new-id', role: 'CUSTOMER', emailVerified: false, ...data };
        users.set(data.email, u);
        return select
          ? { id: u.id, email: u.email, fullName: u.fullName, role: u.role, emailVerified: u.emailVerified }
          : u;
      },
    },
    emailVerificationToken: { create: async () => ({}) },
    passwordResetToken: { create: async () => ({}) },
  };
  const mail = {
    buildVerificationEmail: () => ({ subject: 's', html: 'h', text: 't' }),
    buildResetEmail: () => ({ subject: 's', html: 'h', text: 't' }),
    send: opts.mailSend ?? (async () => {}),
  };
  const events = { record: async () => {} };
  const svc = new AuthService(prisma as any, new JwtService({}), mail as any, {} as any, events as any);
  return { svc };
}

test('register returns an identical generic body for a new and an existing email (no 409/201 oracle)', async () => {
  const { svc } = makeService();
  const rNew = await svc.register({ email: 'new@example.com', fullName: 'New Person', password: STRONG }, {});
  const rDup = await svc.register({ email: 'victim@example.com', fullName: 'Someone Else', password: STRONG }, {});
  assert.deepEqual(rNew, { ok: true });
  assert.deepEqual(rDup, { ok: true });
});

test('register does not throw a 409 when the email already exists', async () => {
  const { svc } = makeService();
  await assert.doesNotReject(
    svc.register({ email: 'victim@example.com', fullName: 'X', password: STRONG }, {}),
  );
});

test('requestPasswordReset does not await the email provider (closes the timing oracle)', async () => {
  let sendResolved = false;
  const { svc } = makeService({
    mailSend: () =>
      new Promise<void>((res) =>
        setImmediate(() => {
          sendResolved = true;
          res();
        }),
      ),
  });
  // Existing account → the hit branch runs and would await the (deferred) send.
  await svc.requestPasswordReset('victim@example.com', {});
  assert.equal(sendResolved, false, 'the reset request must return before the email send resolves');
});
