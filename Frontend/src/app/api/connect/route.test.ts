/**
 * Route-level tests for POST /api/connect — origin gate, Content-Length
 * requirement, throttle semantics (incl. the concurrent-burst case), the
 * attachment pipeline, the redaction invariant, and the sanitized delivery-
 * failure path — all through the real handler, no HTTP server. Run alone:
 *   npx tsx --test src/app/api/connect/route.test.ts
 *
 * The module-level rate limiter persists for the process, so every test uses
 * its own X-Forwarded-For key.
 */
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { MAX_ATTACHMENT_BYTES } from '@/lib/connect';
import { POST } from './route';

// Force the log-only branch by default (tests must never call Resend), give
// the redaction test a stable key, and capture instead of printing.
delete process.env.RESEND_API_KEY;
process.env.CONNECT_LOG_KEY = 'test-log-key';
const warnMock = mock.method(console, 'warn', () => {});
const errorMock = mock.method(console, 'error', () => {});

const BOUNDARY = 'connect-route-test-boundary';

const VALID: Record<string, string> = {
  name: 'Asha',
  phone: '9819488857',
  email: 'asha@example.com',
  message: 'Order query',
};

interface FilePart {
  filename: string;
  type: string;
  data: Uint8Array;
}

function multipartBody(fields: Record<string, string>, file?: FilePart) {
  const chunks: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  if (file) {
    chunks.push(Buffer.from(
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="attachment"; filename="${file.filename}"\r\nContent-Type: ${file.type}\r\n\r\n`,
    ));
    chunks.push(Buffer.from(file.data), Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  // Copy into a fresh ArrayBuffer-backed view — Buffer.concat's result is
  // ArrayBufferLike-backed, which BodyInit's typing rejects.
  const joined = Buffer.concat(chunks);
  const body = new Uint8Array(new ArrayBuffer(joined.byteLength));
  body.set(joined);
  return body;
}

function request(
  fields: Record<string, string>,
  opts: { ip: string; origin?: string; contentLength?: number | false; file?: FilePart } = { ip: 'unset' },
): NextRequest {
  const body = multipartBody(fields, opts.file);
  const headers = new Headers({
    host: 'localhost:3000',
    'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
    'x-forwarded-for': opts.ip,
  });
  // A constructed Request does NOT expose an implicit content-length header,
  // so the route sees exactly what we set here — `false` simulates chunked.
  if (opts.contentLength !== false) headers.set('content-length', String(opts.contentLength ?? body.byteLength));
  if (opts.origin) headers.set('origin', opts.origin);
  return new NextRequest('http://localhost:3000/api/connect', { method: 'POST', headers, body });
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
const EXE_BYTES = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x70, 0x61, 0x79, 0x6c, 0x6f, 0x61, 0x64, 0x21, 0, 0, 0, 0]);

test('origin gate: a cross-origin POST is refused with 403 before any parsing', async () => {
  const res = await POST(request(VALID, { ip: 'rt-origin-evil', origin: 'https://evil.example' }));
  assert.equal(res.status, 403);
  assert.equal((await res.json()).ok, false);
});

test('origin gate: a malformed Origin header is refused, not crashed on', async () => {
  const res = await POST(request(VALID, { ip: 'rt-origin-junk', origin: 'not a url' }));
  assert.equal(res.status, 403);
});

test('origin gate: the same-origin POST goes through to acceptance', async () => {
  const res = await POST(request(VALID, { ip: 'rt-origin-same', origin: 'http://localhost:3000' }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);
});

test('content-length is required: a length-less (chunked) body is refused with 411', async () => {
  const res = await POST(request(VALID, { ip: 'rt-chunked', contentLength: false }));
  assert.equal(res.status, 411);
});

test('content-length over the body cap is refused with 413 before parsing', async () => {
  const res = await POST(request(VALID, { ip: 'rt-oversize', contentLength: MAX_ATTACHMENT_BYTES + 64 * 1024 + 1 }));
  assert.equal(res.status, 413);
  assert.match((await res.json()).errors?.attachment ?? '', /4MB or smaller/);
});

test('attachment pipeline: a real PNG is accepted end-to-end', async () => {
  const res = await POST(request(VALID, {
    ip: 'rt-attach-png',
    file: { filename: 'photo.png', type: 'image/png', data: PNG_BYTES },
  }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);
});

test('attachment pipeline: an EXE declared as application/pdf is sniffed and refused', async () => {
  const res = await POST(request(VALID, {
    ip: 'rt-attach-exe',
    file: { filename: 'invoice.pdf', type: 'application/pdf', data: EXE_BYTES },
  }));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).errors?.attachment, 'Attach an image or a PDF.');
});

test('throttle: validation failures do not consume the budget; accepted submissions do', async () => {
  const ip = 'rt-throttle-mixed';
  for (let i = 0; i < 4; i++) {
    const res = await POST(request({ ...VALID, name: '' }, { ip }));
    assert.equal(res.status, 400, 'invalid submission must 400');
  }
  for (let i = 1; i <= 5; i++) {
    const res = await POST(request(VALID, { ip }));
    assert.equal(res.status, 200, `accepted submission #${i} must pass — earlier 400s must not count`);
  }
  const sixth = await POST(request(VALID, { ip }));
  assert.equal(sixth.status, 429, 'the 6th accepted submission must be throttled');
});

test('throttle: honeypot hits count against the budget (bots get throttled too)', async () => {
  const ip = 'rt-throttle-honeypot';
  for (let i = 0; i < 5; i++) {
    const res = await POST(request({ ...VALID, _gotcha: 'spam' }, { ip }));
    assert.equal(res.status, 200, 'honeypot submissions are silently accepted');
  }
  const res = await POST(request(VALID, { ip }));
  assert.equal(res.status, 429);
});

test('throttle: a CONCURRENT burst cannot overshoot — exactly 5 of 10 parallel posts pass', async () => {
  const ip = 'rt-throttle-burst';
  const responses = await Promise.all(
    Array.from({ length: 10 }, () => POST(request(VALID, { ip }))),
  );
  const codes = responses.map((r) => r.status).sort();
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 429, 429, 429, 429, 429]);
});

test('redaction invariant: the log-only fallback emits no PII — only id, time, keyed digest, presence flags', async () => {
  warnMock.mock.resetCalls();
  const pii = {
    name: 'Zephyrina Quixote',
    phone: '9876501234',
    email: 'Zephyrina.Quixote@example.com',
    message: 'SECRET-MESSAGE-CONTENT-XYZZY',
  };
  const res = await POST(request(pii, {
    ip: 'rt-redaction',
    file: { filename: 'rx-photo.png', type: 'image/png', data: PNG_BYTES },
  }));
  assert.equal(res.status, 200);

  assert.equal(warnMock.mock.calls.length, 1, 'exactly one redacted reference line');
  const logged = warnMock.mock.calls[0].arguments.map(String).join(' ');
  for (const value of [pii.name, pii.phone, pii.email, pii.message, 'Zephyrina', 'XYZZY', 'rx-photo']) {
    assert.ok(!logged.includes(value), `log line must not contain ${JSON.stringify(value)}`);
  }
  const payload = JSON.parse(logged.slice(logged.indexOf('{')));
  assert.match(payload.submissionId, /^[0-9a-f-]{36}$/);
  const expectedDigest = createHmac('sha256', 'test-log-key').update(pii.email.toLowerCase()).digest('hex').slice(0, 16);
  assert.equal(payload.emailHmac, expectedDigest, 'digest must be the KEYED hmac, reproducible by staff holding the key');
  assert.deepEqual(payload.fields, { name: true, phone: true, email: true, message: true, attachment: true });
});

test('delivery failure: 502 logs a sanitized message (no Resend body) and refunds the claim', async () => {
  const ip = 'rt-resend-fail';
  process.env.RESEND_API_KEY = 're_test_key';
  const fetchMock = mock.method(globalThis, 'fetch', async () =>
    new Response('{"error":"only deliverable to secret-owner@woodhouse.test"}', { status: 500 }),
  );
  errorMock.mock.resetCalls();
  try {
    const res = await POST(request(VALID, { ip }));
    assert.equal(res.status, 502);
  } finally {
    fetchMock.mock.restore();
    delete process.env.RESEND_API_KEY;
  }
  const failureCall = errorMock.mock.calls.find((c) => String(c.arguments[0]).includes('delivery failed'));
  assert.ok(failureCall, 'delivery failure must be logged');
  assert.equal(failureCall.arguments[1], 'Resend responded 500', 'production log carries the status only');
  assert.ok(
    !failureCall.arguments.map(String).join(' ').includes('secret-owner'),
    'the third-party response body must not reach the failure log',
  );

  // The failed submission was refunded — a full budget of 5 must still pass.
  for (let i = 1; i <= 5; i++) {
    const res = await POST(request(VALID, { ip }));
    assert.equal(res.status, 200, `post-refund submission #${i} must pass`);
  }
  assert.equal((await POST(request(VALID, { ip }))).status, 429);
});
