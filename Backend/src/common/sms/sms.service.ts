import { Injectable, Logger } from '@nestjs/common';
import { env } from '../config/env';

/**
 * Outbound OTP SMS. Uses MSG91 (Indian DLT-compliant provider) when
 * configured. Falls back to a structured log line in development so the
 * phone-login flow can be exercised without an SMS account. Never throws
 * into the caller — failed sends are logged; the auth flow continues and
 * the user simply requests another code.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  get isConfigured(): boolean {
    return Boolean(env.MSG91_AUTH_KEY && env.MSG91_TEMPLATE_ID);
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    if (!this.isConfigured) {
      // Mirror MailService's noop discipline: never write the code to prod
      // logs (SIEM/analytics ingestion), but surface it in dev so the flow
      // is testable end-to-end without MSG91 credentials.
      const meta = { scope: 'sms:noop', to: maskPhone(phone) };
      if (env.NODE_ENV === 'production') {
        this.logger.error(JSON.stringify({ ...meta, error: 'SMS provider not configured' }));
      } else {
        this.logger.warn(JSON.stringify({ ...meta, devOtp: code }));
      }
      return;
    }
    try {
      // MSG91 "Send OTP" API v5 — the template must contain the ##OTP## var.
      const url = new URL('https://control.msg91.com/api/v5/otp');
      url.searchParams.set('template_id', env.MSG91_TEMPLATE_ID as string);
      url.searchParams.set('mobile', phone.replace(/^\+/, ''));
      url.searchParams.set('otp', code);
      const res = await fetch(url, {
        method: 'POST',
        headers: { authkey: env.MSG91_AUTH_KEY as string },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '<unreadable>');
        this.logger.error(`MSG91 ${res.status}: ${body.slice(0, 200)}`);
      }
    } catch (err) {
      this.logger.error(`MSG91 send failed: ${(err as Error).message}`);
    }
  }
}

function maskPhone(phone: string): string {
  return phone.replace(/(\+\d{2})\d{6}(\d{4})/, '$1******$2');
}
