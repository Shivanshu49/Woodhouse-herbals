import { NextRequest, NextResponse } from 'next/server';
import {
  ATTACHMENT_SIZE_ERROR,
  ATTACHMENT_TYPE_ERROR,
  MAX_ATTACHMENT_BYTES,
  attachmentLooksAllowed,
} from '@/lib/connect';

export const runtime = 'nodejs';

// Attachment cap + ~64KB for the text fields and multipart framing. Checked
// against Content-Length BEFORE req.formData(), which would otherwise buffer
// an arbitrarily large body into memory just to reject it.
const MAX_BODY_BYTES = MAX_ATTACHMENT_BYTES + 64 * 1024;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Indian numbers with optional +91/0 prefix; keeps validation loose enough for
// spaced/hyphenated input — digits are checked after stripping separators.
const PHONE_RE = /^(\+?91|0)?[6-9]\d{9}$/;

const CONNECT_TO = process.env.CONNECT_TO_EMAIL ?? 'info@woodhouseherbals.com';
// NOTE: the resend.dev fallback is Resend's sandbox sender and can only
// deliver to the Resend account owner's inbox — production must set
// CONNECT_FROM_EMAIL on a verified domain (tracked in docs/PRE-LAUNCH.md).
const CONNECT_FROM = process.env.CONNECT_FROM_EMAIL ?? 'Wood House Herbals <onboarding@resend.dev>';

// Best-effort per-IP throttle: 5 submissions / 10 minutes. In-memory, so each
// serverless instance counts separately — this blunts bursts (inbox flooding,
// Resend-quota burn), it is not a durable global limit. Only ACCEPTED
// submissions count (recordHit runs after validation): a user retrying past
// form errors isn't burning their budget on each 400.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, { count: number; reset: number }>();

function rateLimited(ip: string, now: number): boolean {
  const h = hits.get(ip);
  return !!h && h.reset >= now && h.count >= RATE_LIMIT;
}

function recordHit(ip: string, now: number): void {
  if (hits.size > 10_000) {
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }
  const h = hits.get(ip);
  if (!h || h.reset < now) hits.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
  else h.count += 1;
}

interface Submission {
  name: string;
  phone: string;
  email: string;
  message: string;
  attachment: File | null;
}

function validate(form: FormData): { data?: Submission; errors?: Record<string, string> } {
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
  // Length gate BEFORE the regex: EMAIL_RE backtracks quadratically on
  // pathological input, so it must never see an unbounded string.
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
function sniffAttachment(bytes: Uint8Array): string | null {
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
function safeFilename(original: string, ext: string): string {
  const stem = (original.split(/[\\/]/).pop() ?? 'attachment')
    .replace(/(\.[a-zA-Z0-9]{1,8})+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 60);
  return `${stem || 'attachment'}.${ext}`;
}

async function sendViaResend(apiKey: string, s: Submission, filename: string | null): Promise<void> {
  const attachments = s.attachment && filename
    ? [{
        filename,
        content: Buffer.from(await s.attachment.arrayBuffer()).toString('base64'),
      }]
    : undefined;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: CONNECT_FROM,
      to: [CONNECT_TO],
      reply_to: s.email,
      subject: `Connect With Us — ${s.name}`,
      text: [
        `Name: ${s.name}`,
        `Phone: ${s.phone}`,
        `Email: ${s.email}`,
        '',
        s.message,
        '',
        s.attachment && filename
          ? `Attachment: ${filename} (${Math.round(s.attachment.size / 1024)} KB)`
          : 'No attachment.',
      ].join('\n'),
      attachments,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

export async function POST(req: NextRequest) {
  // Same-origin gate: browsers always send Origin on cross-site POSTs; a
  // mismatch is CSRF or an off-site scraper. Absent header (curl, native
  // apps) is allowed through to the other guards.
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json({ ok: false, error: 'Cross-origin submissions are not accepted.' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ ok: false, error: 'Cross-origin submissions are not accepted.' }, { status: 403 });
    }
  }

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.ip || 'unknown';
  if (rateLimited(ip, Date.now())) {
    return NextResponse.json(
      { ok: false, error: 'Too many messages from this connection — please try again in a few minutes.' },
      { status: 429 },
    );
  }

  // A missing/garbage Content-Length means a chunked body the size check can't
  // see — req.formData() would buffer it into memory without bound. Browsers
  // always send Content-Length for FormData posts, so requiring it costs
  // legitimate submissions nothing.
  const rawLength = req.headers.get('content-length');
  const contentLength = Number(rawLength);
  if (!rawLength || !Number.isFinite(contentLength)) {
    return NextResponse.json({ ok: false, error: 'Content-Length is required.' }, { status: 411 });
  }
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, errors: { attachment: ATTACHMENT_SIZE_ERROR } },
      { status: 413 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Send the form as multipart/form-data.' }, { status: 400 });
  }

  // Honeypot: bots fill every field; humans never see this one. The name is
  // deliberately meaningless — autofill heuristics fill real tokens like
  // "company", silently eating genuine submissions. Counts against the rate
  // limit: a bot hammering the honeypot should still get throttled.
  if (String(form.get('_gotcha') ?? '').trim() !== '') {
    recordHit(ip, Date.now());
    return NextResponse.json({ ok: true });
  }

  const { data, errors } = validate(form);
  if (!data) return NextResponse.json({ ok: false, errors }, { status: 400 });

  let attachmentName: string | null = null;
  if (data.attachment) {
    const head = new Uint8Array(await data.attachment.slice(0, 16).arrayBuffer());
    const ext = sniffAttachment(head);
    if (!ext) {
      return NextResponse.json(
        { ok: false, errors: { attachment: ATTACHMENT_TYPE_ERROR } },
        { status: 400 },
      );
    }
    attachmentName = safeFilename(data.attachment.name, ext);
  }

  recordHit(ip, Date.now());
  const apiKey = process.env.RESEND_API_KEY;
  try {
    if (apiKey) {
      await sendViaResend(apiKey, data, attachmentName);
    } else {
      // No email provider configured — surface the submission in server logs
      // (visible in Vercel function logs) rather than pretending to persist.
      // Deliberate per spec, but logs rotate: RESEND_API_KEY is a go-live
      // blocker (docs/PRE-LAUNCH.md).
      console.warn('[connect-us] RESEND_API_KEY not set — submission NOT emailed, log-only:', JSON.stringify({
        name: data.name,
        phone: data.phone,
        email: data.email,
        message: data.message,
        attachment: data.attachment ? { name: attachmentName, size: data.attachment.size, type: data.attachment.type } : null,
        at: new Date().toISOString(),
      }));
    }
  } catch (err) {
    console.error('[connect-us] delivery failed:', err);
    return NextResponse.json(
      { ok: false, error: 'We could not send your message right now. Please try again, or email us directly.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
