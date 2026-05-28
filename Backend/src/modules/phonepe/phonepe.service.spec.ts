/**
 * Minimal contract tests for the PhonePe signature verification.
 *
 * Uses Node's built-in `node:test` runner so we can ship a regression test
 * without dragging in Jest. Run with:
 *
 *   npx tsx --test src/modules/phonepe/phonepe.service.spec.ts
 *
 * The bug that motivated these tests: the previous controller re-serialised
 * `req.body` via `JSON.stringify` before computing the HMAC. PhonePe signs
 * the raw bytes, so any whitespace/key-order drift broke verification.
 * These tests assert that verification is byte-exact and constant-time.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PhonepeService } from './phonepe.service';

const SALT_KEY = 'test-salt-key';
const SALT_INDEX = '1';

function makeService(): PhonepeService {
  // We only exercise verifySignature, which touches neither Prisma nor
  // the inventory service. The stubs are shaped just enough to satisfy
  // the constructor.
  const prismaStub = {} as never;
  const inventoryStub = {} as never;
  return new PhonepeService(prismaStub, inventoryStub);
}

function signature(body: string): string {
  return `${createHash('sha256').update(body + SALT_KEY).digest('hex')}###${SALT_INDEX}`;
}

test('verifySignature: accepts a correctly signed body', () => {
  process.env.PHONEPE_SALT_KEY = SALT_KEY;
  process.env.PHONEPE_SALT_INDEX = SALT_INDEX;
  const svc = makeService();

  const body = '{"response":"eyJtZXJjaGFudFRyYW5zYWN0aW9uSWQiOiJBQkMifQ=="}';
  assert.equal(svc.verifySignature(body, signature(body)), true);
});

test('verifySignature: rejects a tampered body', () => {
  process.env.PHONEPE_SALT_KEY = SALT_KEY;
  process.env.PHONEPE_SALT_INDEX = SALT_INDEX;
  const svc = makeService();

  const original = '{"response":"eyJzdGF0ZSI6IkNPTVBMRVRFRCJ9"}';
  const tampered = '{"response":"eyJzdGF0ZSI6IkZBSUxFRCJ9"}';
  // Signature was minted for the original, but caller supplies the tampered body.
  assert.equal(svc.verifySignature(tampered, signature(original)), false);
});

test('verifySignature: rejects a re-serialised body (the original bug)', () => {
  process.env.PHONEPE_SALT_KEY = SALT_KEY;
  process.env.PHONEPE_SALT_INDEX = SALT_INDEX;
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
  process.env.PHONEPE_SALT_KEY = SALT_KEY;
  process.env.PHONEPE_SALT_INDEX = SALT_INDEX;
  const svc = makeService();
  assert.equal(svc.verifySignature('{"x":1}', ''), false);
});

test('verifySignature: length-mismatched signatures fail constant-time', () => {
  process.env.PHONEPE_SALT_KEY = SALT_KEY;
  process.env.PHONEPE_SALT_INDEX = SALT_INDEX;
  const svc = makeService();
  // timingSafeEqual would throw on mismatched lengths; we want false instead.
  assert.equal(svc.verifySignature('{"x":1}', 'short###1'), false);
});
