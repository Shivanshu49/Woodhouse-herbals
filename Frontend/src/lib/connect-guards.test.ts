/**
 * Unit tests for the /api/connect trust boundary — one test per reject class
 * the route enforces, plus boundary pins so single-mutation regressions
 * (>= vs >, off-by-one caps, inverted conditions) fail loudly. Run alone:
 *   npx tsx --test src/lib/connect-guards.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIpFromXff, createRateLimiter, safeFilename, sniffAttachment, validateSubmission } from './connect-guards';
import { MAX_ATTACHMENT_BYTES, attachmentLooksAllowed } from './connect';

// ---------------------------------------------------------------- sniffing

// No return annotations: inference keeps the ArrayBuffer-backed generic that
// BlobPart's typing demands (a bare `Uint8Array` widens to ArrayBufferLike).
function bytes(...parts: Array<string | number[]>) {
  const out: number[] = [];
  for (const p of parts) {
    if (typeof p === 'string') for (const ch of p) out.push(ch.charCodeAt(0));
    else out.push(...p);
  }
  return new Uint8Array(out);
}

/** Fixture padded past the 12-byte sniff window (most real files are). */
function padded(...parts: Array<string | number[]>) {
  const raw = bytes(...parts);
  if (raw.length >= 16) return raw;
  const out = new Uint8Array(16);
  out.set(raw);
  return out;
}

test('sniff: an EXE declared as application/pdf is rejected (MZ magic, not %PDF)', () => {
  assert.equal(sniffAttachment(padded('MZ', [0x90, 0x00], 'payload')), null);
});

test('sniff: non-allowed but real formats are rejected (BMP, plain text)', () => {
  assert.equal(sniffAttachment(padded('BM', [0x76, 0x02, 0x00, 0x00])), null);
  assert.equal(sniffAttachment(bytes('hello, this is a plain text file')), null);
});

test('sniff: real magic bytes map to their canonical extension', () => {
  assert.equal(sniffAttachment(padded([0xff, 0xd8, 0xff], 'rest')), 'jpg');
  assert.equal(sniffAttachment(padded([0x89], 'PNG\r\n')), 'png');
  assert.equal(sniffAttachment(padded('GIF89a')), 'gif');
  assert.equal(sniffAttachment(padded('RIFF', [0, 0, 0, 0], 'WEBP')), 'webp');
  assert.equal(sniffAttachment(padded('%PDF-1.4')), 'pdf');
  assert.equal(sniffAttachment(padded([0, 0, 0, 24], 'ftypmif1')), 'heic');
});

test('sniff: the 12-byte minimum window is exact — 11 bytes reject, 12 accept', () => {
  const pdf12 = bytes('%PDF-1.4', [0x0a, 0x25, 0x25, 0x25]); // 12 bytes
  assert.equal(pdf12.length, 12);
  assert.equal(sniffAttachment(pdf12), 'pdf');
  assert.equal(sniffAttachment(pdf12.subarray(0, 11)), null, '11 bytes must not clear the window');
  assert.equal(sniffAttachment(new Uint8Array(0)), null);
});

// ------------------------------------------------------- filename hygiene

test('filename: path traversal and shell-hostile characters are neutralized', () => {
  assert.equal(safeFilename('../..//weird name!!.PNG', 'png'), 'weird-name.png');
});

test('filename: EVERY trailing extension token is stripped, then the sniffed one appended', () => {
  assert.equal(safeFilename('prescription.pdf.exe', 'pdf'), 'prescription.pdf');
  assert.equal(safeFilename('archive.2024.pdf', 'pdf'), 'archive.pdf');
});

test('filename: a name that is nothing but dots/extensions falls back to "attachment"', () => {
  assert.equal(safeFilename('....', 'pdf'), 'attachment.pdf');
  assert.equal(safeFilename('.pdf.exe', 'png'), 'attachment.png');
});

test('filename: stem cap is exactly 60 chars', () => {
  assert.equal(safeFilename(`${'a'.repeat(200)}.png`, 'png'), `${'a'.repeat(60)}.png`);
  assert.equal(safeFilename(`${'a'.repeat(60)}.png`, 'png'), `${'a'.repeat(60)}.png`);
});

// ---------------------------------------------- validation (trust boundary)

function form(fields: Record<string, string | File>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const VALID = {
  name: 'Asha',
  phone: '9819488857',
  email: 'asha@example.com',
  message: 'Order query',
};

test('validate: a well-formed submission passes', () => {
  const { data, errors } = validateSubmission(form(VALID));
  assert.equal(errors, undefined);
  assert.equal(data?.email, 'asha@example.com');
});

test('validate: a valid attachment SURVIVES into data.attachment (accept path)', () => {
  const png = new File([padded([0x89], 'PNG\r\n')], 'photo.png', { type: 'image/png' });
  const { data, errors } = validateSubmission(form({ ...VALID, attachment: png }));
  assert.equal(errors, undefined);
  assert.ok(data?.attachment, 'valid attachment must not be dropped');
  assert.equal(data?.attachment?.name, 'photo.png');
});

test('validate: length gate runs BEFORE the email regex — pathological input returns fast', () => {
  // EMAIL_RE backtracks quadratically; without the length-first ordering this
  // input pins the event loop for MINUTES, so a 2s budget distinguishes the
  // orderings decisively without being flaky on a loaded CI runner.
  const evil = `a@${'.'.repeat(500_000)}@`;
  const started = Date.now();
  const { errors } = validateSubmission(form({ ...VALID, email: evil }));
  const elapsed = Date.now() - started;
  assert.equal(errors?.email, 'Enter a valid email address.');
  assert.ok(elapsed < 2_000, `validation took ${elapsed}ms — length gate did not short-circuit the regex`);
});

test('validate: email length boundary is exactly 254', () => {
  const at254 = `${'a'.repeat(249)}@b.co`;
  assert.equal(at254.length, 254);
  assert.equal(validateSubmission(form({ ...VALID, email: at254 })).errors, undefined);
  const at255 = `${'a'.repeat(250)}@b.co`;
  assert.equal(validateSubmission(form({ ...VALID, email: at255 })).errors?.email, 'Enter a valid email address.');
});

test('validate: name cap is exactly 120', () => {
  assert.equal(validateSubmission(form({ ...VALID, name: 'n'.repeat(120) })).errors, undefined);
  assert.equal(validateSubmission(form({ ...VALID, name: 'n'.repeat(121) })).errors?.name, 'Name is too long.');
});

test('validate: message cap is exactly 5000', () => {
  assert.equal(validateSubmission(form({ ...VALID, message: 'm'.repeat(5000) })).errors, undefined);
  assert.match(validateSubmission(form({ ...VALID, message: 'm'.repeat(5001) })).errors?.message ?? '', /too long/);
});

test('validate: phone is length-capped before pattern checks', () => {
  const { errors } = validateSubmission(form({ ...VALID, phone: '9'.repeat(64) }));
  assert.equal(errors?.phone, 'Enter a valid Indian phone number.');
});

test('validate: oversized attachment is rejected at the shared byte cap', () => {
  const big = new File([new Uint8Array(MAX_ATTACHMENT_BYTES + 1)], 'big.png', { type: 'image/png' });
  const { errors } = validateSubmission(form({ ...VALID, attachment: big }));
  assert.match(errors?.attachment ?? '', /4MB or smaller/);
});

test('validate: disallowed declared type is rejected', () => {
  const bmp = new File([new Uint8Array(64)], 'photo.bmp', { type: 'image/bmp' });
  const { errors } = validateSubmission(form({ ...VALID, attachment: bmp }));
  assert.equal(errors?.attachment, 'Attach an image or a PDF.');
});

// -------------------------------------------------- shared allow-list rules

test('allow-list: declared MIME wins when present; extension is the empty-type fallback', () => {
  assert.equal(attachmentLooksAllowed({ type: 'image/png', name: 'x.bin' }), true);
  assert.equal(attachmentLooksAllowed({ type: 'image/bmp', name: 'x.png' }), false);
  assert.equal(attachmentLooksAllowed({ type: '', name: 'photo.HEIC' }), true);
  assert.equal(attachmentLooksAllowed({ type: '', name: 'notes.txt' }), false);
});

// -------------------------------------------------------------- throttling

const WINDOW = 10 * 60 * 1000;

test('throttle: acquire is atomic — the 6th claim in one instant fails, no interleaving needed', () => {
  const rl = createRateLimiter(5, WINDOW);
  const results = Array.from({ length: 10 }, () => rl.tryAcquire('ip-a', 1_000));
  assert.deepEqual(results, [true, true, true, true, true, false, false, false, false, false]);
});

test('throttle: release refunds a claim, and never below zero', () => {
  const rl = createRateLimiter(5, WINDOW);
  for (let i = 0; i < 5; i++) assert.equal(rl.tryAcquire('ip-b', 1_000), true);
  assert.equal(rl.tryAcquire('ip-b', 1_000), false);
  rl.release('ip-b', 1_000);
  assert.equal(rl.tryAcquire('ip-b', 1_000), true, 'released budget must be reusable');
  // over-release must not mint extra budget
  const rl2 = createRateLimiter(5, WINDOW);
  assert.equal(rl2.tryAcquire('ip-c', 1_000), true);
  for (let i = 0; i < 10; i++) rl2.release('ip-c', 1_000);
  const grants = Array.from({ length: 7 }, () => rl2.tryAcquire('ip-c', 1_000)).filter(Boolean).length;
  assert.equal(grants, 5, 'count must floor at zero — over-release cannot raise the cap');
});

test('throttle: window edge is inclusive — limited AT reset, free one ms after', () => {
  const rl = createRateLimiter(5, WINDOW);
  for (let i = 0; i < 5; i++) rl.tryAcquire('ip-d', 1_000);
  assert.equal(rl.tryAcquire('ip-d', 1_000 + WINDOW), false, 'exactly at reset must still be limited');
  assert.equal(rl.tryAcquire('ip-d', 1_000 + WINDOW + 1), true, 'one ms past reset starts a fresh window');
});

test('throttle: IPs are isolated from each other', () => {
  const rl = createRateLimiter(5, WINDOW);
  for (let i = 0; i < 5; i++) rl.tryAcquire('ip-e', 1_000);
  assert.equal(rl.tryAcquire('ip-e', 2_000), false);
  assert.equal(rl.tryAcquire('ip-f', 2_000), true);
});

// Small injected thresholds — the eviction logic is identical at 10k/50k, the
// tests just shouldn't need tens of thousands of Map operations to reach it.
const CAPS = { sweepAt: 5, clearAt: 12 };

test('throttle: expired keys are swept once the map grows past sweepAt', () => {
  const rl = createRateLimiter(5, WINDOW, CAPS);
  for (let i = 0; i < 6; i++) rl.tryAcquire(`rot-${i}`, 1_000);
  assert.equal(rl.size(), 6);
  rl.tryAcquire('fresh', 1_000 + WINDOW + 1); // all rot-* expired -> sweep
  assert.equal(rl.size(), 1, 'expired keys must be evicted, only the fresh key remains');
});

test('throttle: a rotating-key flood inside ONE window sheds state at clearAt instead of growing unbounded', () => {
  const rl = createRateLimiter(5, WINDOW, CAPS);
  for (let i = 0; i < 13; i++) rl.tryAcquire(`live-${i}`, 1_000);
  assert.ok(rl.size() < CAPS.sweepAt, `map must be shed under unexpired-key rotation, size=${rl.size()}`);
});

test('client-ip: with one trusted proxy, the rightmost XFF entry is the client', () => {
  assert.equal(clientIpFromXff('203.0.113.9', 1, 'fb'), '203.0.113.9');
  assert.equal(clientIpFromXff('  203.0.113.9  ', 1, 'fb'), '203.0.113.9');
});

test('client-ip: a spoofed leftmost XFF entry is ignored — the bucket key cannot be rotated', () => {
  // Attacker prepends a rotating fake; the trusted rightmost hop is constant.
  assert.equal(clientIpFromXff('1.2.3.4, 203.0.113.9', 1, 'fb'), '203.0.113.9');
  assert.equal(clientIpFromXff('9.9.9.9, 203.0.113.9', 1, 'fb'), '203.0.113.9');
  assert.equal(clientIpFromXff('a, b, c, 203.0.113.9', 1, 'fb'), '203.0.113.9');
});

test('client-ip: two trusted proxies peel two entries off the right', () => {
  // chain: client, cf_edge  (Traefik appended cf_edge; Cloudflare appended client)
  assert.equal(clientIpFromXff('198.51.100.7, 172.16.0.1', 2, 'fb'), '198.51.100.7');
  // spoof: attacker prepends fakes; still resolves to the Cloudflare-observed client
  assert.equal(clientIpFromXff('1.1.1.1, 198.51.100.7, 172.16.0.1', 2, 'fb'), '198.51.100.7');
});

test('client-ip: a chain shorter than the trusted hop count fails safe to the fallback', () => {
  assert.equal(clientIpFromXff('203.0.113.9', 2, 'fb'), 'fb');
  assert.equal(clientIpFromXff('', 1, 'fb'), 'fb');
  assert.equal(clientIpFromXff(null, 1, 'fb'), 'fb');
});

test('client-ip: zero trusted hops treats the whole XFF as untrusted', () => {
  assert.equal(clientIpFromXff('203.0.113.9', 0, 'fb'), 'fb');
});
