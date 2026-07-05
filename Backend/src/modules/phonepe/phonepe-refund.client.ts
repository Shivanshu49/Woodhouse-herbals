import { Injectable, Logger } from '@nestjs/common';
import { DEV_FALLBACKS, env } from '../../common/config/env';
import { buildRefundPayload, statusChecksum } from './phonepe-signing';

/** Normalised result of a refund / Check-Status call — the money-state surface. */
export interface PhonepeRefundResult {
  code: string;
  state: string;
  providerRefundId?: string;
  raw: unknown;
}

/**
 * First server→PhonePe S2S caller in the codebase. Signs with the shared
 * X-VERIFY helpers (legacy Hermes scheme), native fetch, 15s timeout, and
 * NEVER logs the salt or the full checksum. All settlement decisions are made
 * by the caller from the normalised `{ code, state, providerRefundId }` — this
 * class only performs the signed IO.
 */
@Injectable()
export class PhonepeRefundClient {
  private readonly logger = new Logger(PhonepeRefundClient.name);

  private creds() {
    return {
      merchantId: env.PHONEPE_MERCHANT_ID ?? DEV_FALLBACKS.PHONEPE_MERCHANT_ID,
      saltKey: env.PHONEPE_SALT_KEY ?? DEV_FALLBACKS.PHONEPE_SALT_KEY,
      saltIndex: env.PHONEPE_SALT_INDEX,
      base: env.PHONEPE_BASE_URL ?? DEV_FALLBACKS.PHONEPE_BASE_URL,
    };
  }

  async refund(input: {
    merchantRefundId: string;
    originalTxnId: string;
    merchantUserId: string;
    amountMinor: number;
  }): Promise<PhonepeRefundResult> {
    const { merchantId, saltKey, saltIndex, base } = this.creds();
    const callbackUrl = `${env.WEB_ORIGIN.split(',')[0]}/api/phonepe/callback`;
    const { base64, checksum } = buildRefundPayload(
      {
        merchantId,
        merchantUserId: input.merchantUserId,
        originalTxnId: input.originalTxnId,
        merchantRefundId: input.merchantRefundId,
        amountMinor: input.amountMinor,
        callbackUrl,
      },
      saltKey,
      saltIndex,
    );
    const res = await this.post(`${base}/pg/v1/refund`, { request: base64 }, checksum);
    return this.parse(res);
  }

  async status(merchantRefundId: string): Promise<PhonepeRefundResult> {
    const { merchantId, saltKey, saltIndex, base } = this.creds();
    const path = `/pg/v1/status/${merchantId}/${merchantRefundId}`;
    const res = await this.get(`${base}${path}`, statusChecksum(path, saltKey, saltIndex), merchantId);
    return this.parse(res);
  }

  private parse(json: any): PhonepeRefundResult {
    return {
      code: json?.code ?? 'UNKNOWN',
      state: json?.data?.state ?? 'PENDING',
      providerRefundId: json?.data?.transactionId as string | undefined,
      raw: json,
    };
  }

  private async post(url: string, body: unknown, checksum: string): Promise<unknown> {
    const r = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
        accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    return r.json();
  }

  private async get(url: string, checksum: string, merchantId: string): Promise<unknown> {
    const r = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(15_000),
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
        'X-MERCHANT-ID': merchantId,
        accept: 'application/json',
      },
    });
    return r.json();
  }
}
