import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT = /^(image\/(jpeg|png|webp|gif|heic|heif)|application\/pdf)$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Indian numbers with optional +91/0 prefix; keeps validation loose enough for
// spaced/hyphenated input — digits are checked after stripping separators.
const PHONE_RE = /^(\+?91|0)?[6-9]\d{9}$/;

const CONNECT_TO = process.env.CONNECT_TO_EMAIL ?? 'info@woodhouseherbals.com';
const CONNECT_FROM = process.env.CONNECT_FROM_EMAIL ?? 'Wood House Herbals <onboarding@resend.dev>';

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
  else if (!PHONE_RE.test(phone.replace(/[\s-]/g, ''))) errors.phone = 'Enter a valid Indian phone number.';
  if (!email) errors.email = 'Enter your email.';
  else if (!EMAIL_RE.test(email) || email.length > 254) errors.email = 'Enter a valid email address.';
  if (!message) errors.message = 'Tell us how we can help.';
  else if (message.length > 5000) errors.message = 'Message is too long (5000 characters max).';

  let file: File | null = null;
  if (attachment instanceof File && attachment.size > 0) {
    if (attachment.size > MAX_ATTACHMENT_BYTES) errors.attachment = 'Attachment must be 5MB or smaller.';
    else if (!ALLOWED_ATTACHMENT.test(attachment.type)) errors.attachment = 'Attach an image or a PDF.';
    else file = attachment;
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { data: { name, phone, email, message, attachment: file } };
}

async function sendViaResend(apiKey: string, s: Submission): Promise<void> {
  const attachments = s.attachment
    ? [{
        filename: s.attachment.name,
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
        s.attachment ? `Attachment: ${s.attachment.name} (${Math.round(s.attachment.size / 1024)} KB)` : 'No attachment.',
      ].join('\n'),
      attachments,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Send the form as multipart/form-data.' }, { status: 400 });
  }

  // Honeypot: bots fill every field; humans never see this one.
  if (String(form.get('company') ?? '').trim() !== '') {
    return NextResponse.json({ ok: true });
  }

  const { data, errors } = validate(form);
  if (!data) return NextResponse.json({ ok: false, errors }, { status: 400 });

  const apiKey = process.env.RESEND_API_KEY;
  try {
    if (apiKey) {
      await sendViaResend(apiKey, data);
    } else {
      // No email provider configured — surface the submission in server logs
      // (visible in Vercel function logs) rather than pretending to persist.
      console.log('[connect-us] submission (RESEND_API_KEY not set, not emailed):', JSON.stringify({
        name: data.name,
        phone: data.phone,
        email: data.email,
        message: data.message,
        attachment: data.attachment ? { name: data.attachment.name, size: data.attachment.size, type: data.attachment.type } : null,
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
