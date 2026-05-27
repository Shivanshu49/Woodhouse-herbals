import { Injectable, Logger } from '@nestjs/common';
import { env } from '../config/env';

interface SendInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Outbound transactional email. Uses Resend when configured. Falls back to a
 * structured log line in development so reset/verify flows can be exercised
 * without a Resend account. Never throws into the caller — failed sends are
 * logged and surfaced to monitoring but auth flows continue.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async send(input: SendInput): Promise<void> {
    if (!env.RESEND_API_KEY) {
      // In dev we need to surface the *content* so the developer can finish
      // the verification / reset flow without a real Resend account, but we
      // must not leak tokens to logs that may be ingested by SIEM, sent to
      // analytics, or copied into a bug report. So: in production we log a
      // bare metadata line; in dev we additionally log the URL stripped of
      // its token query string.
      const meta = { scope: 'mail:noop', to: input.to, subject: input.subject };
      if (env.NODE_ENV === 'production') {
        this.logger.warn(JSON.stringify(meta));
      } else {
        const sanitized = input.text.replace(/(token|otp|code|key|secret)=[^\s&]+/gi, '$1=[redacted]');
        this.logger.warn(JSON.stringify({ ...meta, devPreview: sanitized.slice(0, 240) }));
      }
      return;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '<unreadable>');
        this.logger.error(`Resend ${res.status}: ${body.slice(0, 200)}`);
      }
    } catch (err) {
      this.logger.error(`Resend send failed: ${(err as Error).message}`);
    }
  }

  buildVerificationEmail(verifyUrl: string): { subject: string; html: string; text: string } {
    return {
      subject: 'Confirm your Wood House Herbals account',
      text: `Welcome to Wood House Herbals!\n\nConfirm your email by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours. If you didn’t create an account, you can ignore this email.`,
      html: `<p>Welcome to Wood House Herbals 🌿</p>
<p>Confirm your email by clicking the link below — it expires in 24 hours.</p>
<p><a href="${escapeHtml(verifyUrl)}">Confirm email</a></p>
<p style="color:#777;font-size:12px">If you didn’t create an account, you can ignore this email.</p>`,
    };
  }

  buildResetEmail(resetUrl: string): { subject: string; html: string; text: string } {
    return {
      subject: 'Reset your Wood House Herbals password',
      text: `Someone requested a password reset for your account. If that was you, visit:\n${resetUrl}\n\nThis link expires in 1 hour. If it wasn’t you, ignore this email — your account is safe.`,
      html: `<p>Someone requested a password reset for your account.</p>
<p>If that was you, click below to set a new password (link expires in 1 hour):</p>
<p><a href="${escapeHtml(resetUrl)}">Reset password</a></p>
<p style="color:#777;font-size:12px">If it wasn’t you, you can safely ignore this email — your password hasn’t changed.</p>`,
    };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}
