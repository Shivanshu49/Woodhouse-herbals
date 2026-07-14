import { createHmac, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ATTACHMENT_SIZE_ERROR, ATTACHMENT_TYPE_ERROR, MAX_ATTACHMENT_BYTES } from '@/lib/connect';
import {
  type Submission,
  clientIpFromXff,
  createRateLimiter,
  safeFilename,
  sniffAttachment,
  validateSubmission,
} from '@/lib/connect-guards';

export const runtime = 'nodejs';

// Attachment cap + ~64KB for the text fields and multipart framing. Checked
// against Content-Length BEFORE req.formData(), which would otherwise buffer
// an arbitrarily large body into memory just to reject it.
const MAX_BODY_BYTES = MAX_ATTACHMENT_BYTES + 64 * 1024;

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
const limiter = createRateLimiter(5, 10 * 60 * 1000);

// Reverse proxies in front of this app that append to X-Forwarded-For. The
// limiter key is resolved by peeling this many hops off the RIGHT of XFF, so
// a client-spoofed leftmost entry cannot rotate the bucket. MUST match the
// real chain (Traefik/Coolify => 1; Cloudflare in front => 2) — verify at
// cutover; see clientIpFromXff and docs/PRE-LAUNCH.md (TRUST_PROXY_HOPS).
const TRUSTED_PROXY_HOPS = Number(process.env.TRUSTED_PROXY_HOPS ?? 1);

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
      subject: `Connect With Us: ${s.name}`,
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
    // The response body is a third-party-controlled string that can echo
    // request fields (reply_to = the submitter's email, subject = their
    // name) — it must never reach production logs. Status only in the error;
    // the body is dev-console material.
    if (process.env.NODE_ENV !== 'production') {
      console.error('[connect-us] resend error body (dev only):', (await res.text()).slice(0, 300));
    }
    throw new Error(`Resend responded ${res.status}`);
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

  // Key the throttle on the trusted, proxy-resolved client IP — NOT the
  // leftmost X-Forwarded-For entry, which the client controls and could rotate
  // to reset the bucket every request.
  const ip = clientIpFromXff(req.headers.get('x-forwarded-for'), TRUSTED_PROXY_HOPS, req.ip ?? 'unknown');

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

  // Claim budget BEFORE the body-parse await: a split check-then-record pair
  // straddling formData() lets N concurrent posts all pass the check first.
  // Every rejected outcome below refunds the claim, so only delivered (or
  // honeypot) submissions keep consuming budget.
  if (!limiter.tryAcquire(ip, Date.now())) {
    return NextResponse.json(
      { ok: false, error: 'Too many messages from this connection. Please try again in a few minutes.' },
      { status: 429 },
    );
  }
  const refund = () => limiter.release(ip, Date.now());

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    refund();
    return NextResponse.json({ ok: false, error: 'Send the form as multipart/form-data.' }, { status: 400 });
  }

  // Honeypot: bots fill every field; humans never see this one. The name is
  // deliberately meaningless — autofill heuristics fill real tokens like
  // "company", silently eating genuine submissions. The claim is NOT
  // refunded: a bot hammering the honeypot should still get throttled.
  if (String(form.get('_gotcha') ?? '').trim() !== '') {
    return NextResponse.json({ ok: true });
  }

  const { data, errors } = validateSubmission(form);
  if (!data) {
    refund();
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }

  let attachmentName: string | null = null;
  if (data.attachment) {
    const head = new Uint8Array(await data.attachment.slice(0, 16).arrayBuffer());
    const ext = sniffAttachment(head);
    if (!ext) {
      refund();
      return NextResponse.json(
        { ok: false, errors: { attachment: ATTACHMENT_TYPE_ERROR } },
        { status: 400 },
      );
    }
    attachmentName = safeFilename(data.attachment.name, ext);
  }

  const apiKey = process.env.RESEND_API_KEY;
  try {
    if (apiKey) {
      await sendViaResend(apiKey, data, attachmentName);
    } else {
      // No email provider configured. Log a redacted reference only — no PII
      // may land in Vercel logs (DPDP). emailHmac is a KEYED pseudonymous
      // reference (an unsalted hash of an email is dictionary-reversible):
      // staff holding CONNECT_LOG_KEY can compute a complainant's digest to
      // grep for their submission; without the key the field is omitted
      // entirely. The content itself is unrecoverable either way, so
      // RESEND_API_KEY stays a go-live blocker (docs/PRE-LAUNCH.md).
      const logKey = process.env.CONNECT_LOG_KEY;
      console.warn('[connect-us] RESEND_API_KEY not set — submission NOT emailed; redacted reference only:', JSON.stringify({
        submissionId: randomUUID(),
        at: new Date().toISOString(),
        emailHmac: logKey
          ? createHmac('sha256', logKey).update(data.email.toLowerCase()).digest('hex').slice(0, 16)
          : undefined,
        fields: {
          name: data.name.length > 0,
          phone: data.phone.length > 0,
          email: data.email.length > 0,
          message: data.message.length > 0,
          attachment: data.attachment !== null,
        },
      }));
    }
  } catch (err) {
    // Message only — a full error object could carry response payloads.
    console.error('[connect-us] delivery failed:', err instanceof Error ? err.message : String(err));
    refund();
    return NextResponse.json(
      { ok: false, error: 'We could not send your message right now. Please try again, or email us directly.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
