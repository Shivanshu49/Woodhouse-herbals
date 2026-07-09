/**
 * Server-side pure guards for the /api/connect trust boundary, extracted from
 * the route handler so each reject path is unit-testable in isolation
 * (connect-guards.test.ts — one test per reject class). The shared
 * client+server rules (size cap, allow-list, error copy) live in ./connect;
 * this module is the server-only layer on top and must stay side-effect-free
 * apart from the rate-limiter factory's own Map.
 */
import {
  ATTACHMENT_SIZE_ERROR,
  ATTACHMENT_TYPE_ERROR,
  MAX_ATTACHMENT_BYTES,
  attachmentLooksAllowed,
} from './connect';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Indian numbers with optional +91/0 prefix; keeps validation loose enough for
// spaced/hyphenated input — digits are checked after stripping separators.
const PHONE_RE = /^(\+?91|0)?[6-9]\d{9}$/;

export interface Submission {
  name: string;
  phone: string;
  email: string;
  message: string;
  attachment: File | null;
}

export function validateSubmission(form: FormData): { data?: Submission; errors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const name = String(form.get('name') ?? '').trim();
  const phone = String(form.get('phone') ?? '').trim();
  const email = String(form.get('email') ?? '').trim();
  const message = String(form.get('message') ?? '').trim();
  const attachment = form.get('attachment');

  if (!name) errors.name = 'Enter your name.';
  else if (name.length > 120) errors.name = 'Name is too long.';
  if (!phone) errors.phone = 'Enter your phone number.';
  else if (phone.length > 32 || !PHONE_RE.test(phone.replace(/[\s-]/g, ''))) errors.phone = 'Enter a valid Indian phone number.';
  if (!email) errors.email = 'Enter your email.';
  // Length gate BEFORE the regex: EMAIL_RE backtracks quadratically, so it
  // must never see an unbounded string.
  else if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  if (!message) errors.message = 'Tell us how we can help.';
  else if (message.length > 5000) errors.message = 'Message is too long (5000 characters max).';

  let file: File | null = null;
  if (attachment instanceof File && attachment.size > 0) {
    if (attachment.size > MAX_ATTACHMENT_BYTES) errors.attachment = ATTACHMENT_SIZE_ERROR;
    else if (!attachmentLooksAllowed(attachment)) errors.attachment = ATTACHMENT_TYPE_ERROR;
    else file = attachment;
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { data: { name, phone, email, message, attachment: file } };
}

// Magic-byte sniff — the declared MIME type is attacker-controlled, and this
// file is relayed into the store inbox from a sender staff trust. Returns the
// canonical extension for the detected type, or null if it is none of ours.
export function sniffAttachment(bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png';
  if (ascii(0, 4) === 'GIF8') return 'gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if (ascii(0, 4) === '%PDF') return 'pdf';
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12).toLowerCase();
    if (['heic', 'heix', 'hevc', 'heif', 'mif1', 'msf1'].includes(brand)) return 'heic';
  }
  return null;
}

// Keep a recognizable stem but neutralize path tricks and double extensions:
// every trailing ".token" run is stripped ("invoice.pdf.exe" -> "invoice"),
// then the sniffed extension is appended.
export function safeFilename(original: string, ext: string): string {
  const stem = (original.split(/[\\/]/).pop() ?? 'attachment')
    .replace(/(\.[a-zA-Z0-9]{1,8})+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 60);
  return `${stem || 'attachment'}.${ext}`;
}

export interface RateLimiter {
  /**
   * Atomically claim one unit of the key's budget. Synchronous check-and-
   * increment — a split check/record pair straddling an await lets N
   * concurrent requests all pass the check before any of them records.
   */
  tryAcquire(key: string, now: number): boolean;
  /** Refund a claimed unit (the submission was rejected, not delivered). */
  release(key: string, now: number): void;
  /** Number of tracked keys — exposed for the eviction tests only. */
  size(): number;
}

/**
 * Fixed-window in-memory throttle. The connect route acquires BEFORE parsing
 * the body (closing the concurrent-burst TOCTOU) and releases on every
 * rejected outcome, so only delivered/accepted submissions keep their claim —
 * a user retrying past validation errors isn't burning their budget.
 *
 * Memory bounds: past `sweepAt` keys every acquire evicts expired entries
 * (normal traffic drops back under the threshold and the sweeps stop); if a
 * rotating-key flood keeps everything live, `clearAt` sheds ALL state rather
 * than grow unbounded — fail-open, the platform edge is the real backstop.
 * Under active attack the sweep is O(size) per request, bounded by clearAt
 * (~1-2ms at the default 50k). Thresholds are injectable for the tests only.
 */
export function createRateLimiter(
  limit: number,
  windowMs: number,
  caps: { sweepAt: number; clearAt: number } = { sweepAt: 10_000, clearAt: 50_000 },
): RateLimiter {
  const hits = new Map<string, { count: number; reset: number }>();
  return {
    tryAcquire(key, now) {
      if (hits.size >= caps.sweepAt) {
        for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
        if (hits.size >= caps.clearAt) hits.clear();
      }
      const h = hits.get(key);
      if (!h || h.reset < now) {
        hits.set(key, { count: 1, reset: now + windowMs });
        return true;
      }
      if (h.count >= limit) return false;
      h.count += 1;
      return true;
    },
    release(key, now) {
      const h = hits.get(key);
      if (h && h.reset >= now && h.count > 0) h.count -= 1;
    },
    size() {
      return hits.size;
    },
  };
}
