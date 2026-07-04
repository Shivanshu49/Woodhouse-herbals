/**
 * Unit tests for UploadsService.destroy() — the server-signed Cloudinary
 * delete used by the admin product form's delete-on-remove. `fetch` is stubbed
 * so no network happens; a minimal valid env is provided so the lazy env proxy
 * validates without process.exit.
 * Run alone: npx tsx --test src/modules/uploads/uploads.service.test.ts
 */
import 'reflect-metadata';

// Minimal valid env BEFORE the service (and its env proxy) is first read.
process.env.DATABASE_URL ??= 'postgres://u:p@localhost:5432/wh_test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-value';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-value';
process.env.CLOUDINARY_CLOUD_NAME = 'testcloud';
process.env.CLOUDINARY_API_KEY = 'testkey';
process.env.CLOUDINARY_API_SECRET = 'testsecret';

import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { UploadsService } from './uploads.service';
import { signCloudinaryParams } from './cloudinary-signature';
import { resetEnvCacheForTests } from '../../common/config/env';

const realFetch = globalThis.fetch;

function stubFetch(handler: (url: string, init: { method?: string; body?: unknown }) => unknown) {
  globalThis.fetch = ((url: string, init: { method?: string; body?: unknown } = {}) =>
    Promise.resolve(handler(url, init))) as unknown as typeof fetch;
}

beforeEach(() => {
  process.env.CLOUDINARY_CLOUD_NAME = 'testcloud';
  process.env.CLOUDINARY_API_KEY = 'testkey';
  process.env.CLOUDINARY_API_SECRET = 'testsecret';
  resetEnvCacheForTests();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

test('posts a signed destroy request to the right URL and returns the Cloudinary result', async () => {
  let url = '';
  let body: URLSearchParams | undefined;
  stubFetch((u, init) => {
    url = u;
    body = init.body as URLSearchParams;
    return { ok: true, json: async () => ({ result: 'ok' }) };
  });

  const out = await new UploadsService().destroy('woodhouse/products/abc');

  assert.deepEqual(out, { result: 'ok' });
  assert.equal(url, 'https://api.cloudinary.com/v1_1/testcloud/image/destroy');
  assert.equal(body?.get('public_id'), 'woodhouse/products/abc');
  assert.equal(body?.get('api_key'), 'testkey');
  const ts = Number(body?.get('timestamp'));
  assert.ok(Number.isInteger(ts) && ts > 0, 'timestamp is a unix seconds integer');
  // Signature is computed over the sorted signable params + secret; the secret
  // itself is NEVER placed in the multipart body.
  assert.equal(
    body?.get('signature'),
    signCloudinaryParams({ public_id: 'woodhouse/products/abc', timestamp: ts }, 'testsecret'),
  );
  assert.equal(body?.get('api_secret'), null);
});

test('maps a Cloudinary "not found" into the same shape (already-gone is fine for cleanup)', async () => {
  stubFetch(() => ({ ok: true, json: async () => ({ result: 'not found' }) }));
  assert.deepEqual(await new UploadsService().destroy('woodhouse/products/gone'), { result: 'not found' });
});

test('throws 503 when Cloudinary responds non-OK', async () => {
  stubFetch(() => ({ ok: false, json: async () => ({}) }));
  await assert.rejects(new UploadsService().destroy('woodhouse/products/x'), /Failed to delete the image/);
});

test('throws 503 when Cloudinary credentials are not configured', async () => {
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
  resetEnvCacheForTests();
  let fetched = false;
  stubFetch(() => {
    fetched = true;
    return { ok: true, json: async () => ({ result: 'ok' }) };
  });
  await assert.rejects(new UploadsService().destroy('woodhouse/products/x'), /not configured/);
  assert.equal(fetched, false, 'must not call Cloudinary when unconfigured');
});
