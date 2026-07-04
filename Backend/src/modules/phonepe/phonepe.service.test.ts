/**
 * Minimal contract tests for the PhonePe signature verification.
 *
 * Uses Node's built-in `node:test` runner so we can ship a regression test
 * without dragging in Jest. Run with:
 *
 *   npm test                                                    # full suite
 *   npx tsx --test src/modules/phonepe/phonepe.service.test.ts  # just this file
 *
 * The bug that motivated these tests: the previous controller re-serialised
 * `req.body` via `JSON.stringify` before computing the HMAC. PhonePe signs
 * the raw bytes, so any whitespace/key-order drift broke verification.
 * These tests assert that verification is byte-exact and constant-time.
 */

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resetEnvCacheForTests } from '../../common/config/env';
import { PhonepeService } from './phonepe.service';

const SALT_KEY = 'test-salt-key';
const SALT_INDEX = '1';

function makeService(): PhonepeService {
  // We only exercise verifySignature, which touches none of the injected
  // services. The stubs are shaped just enough to satisfy the constructor.
  const prismaStub = {} as never;
  const inventoryStub = {} as never;
  const webhooksStub = {} as never;
  const eventsStub = {} as never;
  return new PhonepeService(prismaStub, inventoryStub, webhooksStub, eventsStub);
}

function signature(body: string): string {
  return `${createHash('sha256').update(body + SALT_KEY).digest('hex')}###${SALT_INDEX}`;
}

// Reset the memoized env cache before every test so that the
// process.env.* mutations below are picked up by env.PHONEPE_*.
beforeEach(() => {
  process.env.PHONEPE_SALT_KEY = SALT_KEY;
  process.env.PHONEPE_SALT_INDEX = SALT_INDEX;
  // env.ts requires DATABASE_URL + JWT secrets to be set before its Zod
  // schema will validate — even though verifySignature doesn't read them.
  // The proxy lazily loads the whole schema on the FIRST read of any key,
  // so we have to satisfy the entire validator.
  process.env.DATABASE_URL ??= 'postgresql://x:x@localhost:5432/x';
  process.env.JWT_ACCESS_SECRET ??= 'test_access_secret_long_enough';
  process.env.JWT_REFRESH_SECRET ??= 'test_refresh_secret_long_enough';
  resetEnvCacheForTests();
});

test('verifySignature: accepts a correctly signed body', () => {
  const svc = makeService();
  const body = '{"response":"eyJtZXJjaGFudFRyYW5zYWN0aW9uSWQiOiJBQkMifQ=="}';
  assert.equal(svc.verifySignature(body, signature(body)), true);
});

test('verifySignature: rejects a tampered body', () => {
  const svc = makeService();
  const original = '{"response":"eyJzdGF0ZSI6IkNPTVBMRVRFRCJ9"}';
  const tampered = '{"response":"eyJzdGF0ZSI6IkZBSUxFRCJ9"}';
  assert.equal(svc.verifySignature(tampered, signature(original)), false);
});

test('verifySignature: rejects a re-serialised body (the original bug)', () => {
  const svc = makeService();
  // PhonePe might send: '{"a":1,"b":2}' — sign that.
  const wire = '{"a":1,"b":2}';
  const sig = signature(wire);
  // After express.json parses + JSON.stringify re-serialises, key order may
  // change or whitespace may be normalised. The HMAC must not match.
  const reserialised = '{"b":2,"a":1}';
  assert.equal(svc.verifySignature(reserialised, sig), false);
  // And the original must still verify.
  assert.equal(svc.verifySignature(wire, sig), true);
});

test('verifySignature: rejects an empty signature', () => {
  const svc = makeService();
  assert.equal(svc.verifySignature('{"x":1}', ''), false);
});

test('verifySignature: length-mismatched signatures fail constant-time', () => {
  const svc = makeService();
  // timingSafeEqual would throw on mismatched lengths; we want false instead.
  assert.equal(svc.verifySignature('{"x":1}', 'short###1'), false);
});
