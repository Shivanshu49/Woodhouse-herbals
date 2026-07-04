/**
 * Unit tests for the Cloudinary signed-upload orchestration. The XHR is
 * dependency-injected (a fake) so progress / success / error / abort can be
 * driven deterministically without a browser or the network.
 * Run alone: npx tsx --test src/lib/cloudinary-upload.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUploadFormData,
  parseUploadResponse,
  extractCloudinaryError,
  uploadToCloudinary,
  type SignResponse,
  type XhrLike,
} from './cloudinary-upload';

const SIGN: SignResponse = {
  cloudName: 'woodhouseherbals',
  apiKey: '651564',
  timestamp: 1783153639,
  folder: 'woodhouse/products',
  signature: 'abc123signature',
  uploadUrl: 'https://api.cloudinary.com/v1_1/woodhouseherbals/image/upload',
};

const file = () => new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });

/** Minimal fake XHR the tests drive by hand. */
class FakeXhr implements XhrLike {
  method?: string;
  url?: string;
  body?: FormData;
  status = 0;
  responseText = '';
  aborted = false;
  upload: { onprogress: ((e: { loaded: number; total: number; lengthComputable: boolean }) => void) | null } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  send(body: FormData) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
}

test('buildUploadFormData carries the signed fields and the file', () => {
  const form = buildUploadFormData(file(), SIGN);
  assert.equal(form.get('api_key'), '651564');
  assert.equal(form.get('timestamp'), '1783153639');
  assert.equal(form.get('folder'), 'woodhouse/products');
  assert.equal(form.get('signature'), 'abc123signature');
  assert.ok(form.get('file'), 'file field present');
  // The secret must never be in the multipart body — only the signature.
  assert.equal(form.get('api_secret'), null);
});

test('parseUploadResponse maps a Cloudinary payload to our image shape', () => {
  const r = parseUploadResponse(
    JSON.stringify({
      secure_url: 'https://res.cloudinary.com/x/image/upload/v1/woodhouse/products/a.jpg',
      public_id: 'woodhouse/products/a',
      width: 800,
      height: 600,
      bytes: 12345,
      format: 'jpg',
    }),
  );
  assert.deepEqual(r, {
    url: 'https://res.cloudinary.com/x/image/upload/v1/woodhouse/products/a.jpg',
    publicId: 'woodhouse/products/a',
    width: 800,
    height: 600,
    bytes: 12345,
    format: 'jpg',
  });
});

test('parseUploadResponse throws on a payload missing secure_url/public_id or on non-JSON', () => {
  assert.throws(() => parseUploadResponse(JSON.stringify({ foo: 'bar' })));
  assert.throws(() => parseUploadResponse('<html>oops</html>'));
});

test('extractCloudinaryError pulls .error.message when present', () => {
  assert.match(
    extractCloudinaryError(JSON.stringify({ error: { message: 'Invalid cloud_name woodhouseherbals' } }), 401),
    /Invalid cloud_name/,
  );
});

test('extractCloudinaryError falls back to a status message on non-JSON bodies', () => {
  assert.match(extractCloudinaryError('<html>500</html>', 500), /500/);
});

test('uploadToCloudinary resolves with the mapped image and reports fractional progress', async () => {
  let fake!: FakeXhr;
  const seen: number[] = [];
  const p = uploadToCloudinary(file(), SIGN, {
    createXhr: () => (fake = new FakeXhr()),
    onProgress: (f) => seen.push(f),
  });
  assert.equal(fake.method, 'POST');
  assert.equal(fake.url, SIGN.uploadUrl);
  fake.upload.onprogress?.({ loaded: 25, total: 100, lengthComputable: true });
  fake.upload.onprogress?.({ loaded: 100, total: 100, lengthComputable: true });
  fake.status = 200;
  fake.responseText = JSON.stringify({
    secure_url: 'https://res.cloudinary.com/x/image/upload/woodhouse/products/a.jpg',
    public_id: 'woodhouse/products/a',
    width: 10,
    height: 10,
  });
  fake.onload?.();
  const result = await p;
  assert.equal(result.publicId, 'woodhouse/products/a');
  assert.deepEqual(seen, [0.25, 1]);
});

test('uploadToCloudinary rejects with the Cloudinary error message on a non-2xx response', async () => {
  let fake!: FakeXhr;
  const p = uploadToCloudinary(file(), SIGN, { createXhr: () => (fake = new FakeXhr()) });
  fake.status = 401;
  fake.responseText = JSON.stringify({ error: { message: 'Invalid cloud_name woodhouseherbals' } });
  fake.onload?.();
  await assert.rejects(p, /Invalid cloud_name/);
});

test('uploadToCloudinary rejects with a friendly message on a transport error', async () => {
  let fake!: FakeXhr;
  const p = uploadToCloudinary(file(), SIGN, { createXhr: () => (fake = new FakeXhr()) });
  fake.onerror?.();
  await assert.rejects(p, /[Nn]etwork/);
});

test('aborting via an AbortSignal rejects with an AbortError and aborts the request', async () => {
  const ctrl = new AbortController();
  let fake!: FakeXhr;
  const p = uploadToCloudinary(file(), SIGN, {
    createXhr: () => (fake = new FakeXhr()),
    signal: ctrl.signal,
  });
  ctrl.abort();
  await assert.rejects(p, (e: Error) => e.name === 'AbortError');
  assert.equal(fake.aborted, true);
});

test('an already-aborted signal rejects immediately without creating an XHR', async () => {
  const ctrl = new AbortController();
  ctrl.abort();
  let created = false;
  const p = uploadToCloudinary(file(), SIGN, {
    createXhr: () => {
      created = true;
      return new FakeXhr();
    },
    signal: ctrl.signal,
  });
  await assert.rejects(p, (e: Error) => e.name === 'AbortError');
  assert.equal(created, false);
});
