import { Injectable, Logger } from '@nestjs/common';
import { DEV_FALLBACKS, env } from '../../common/config/env';
import { buildRefundPayload, statusChecksum } from './phonepe-signing';

/** Normalised result of a refund / Check-Status call — the money-state surface. */
export interface PhonepeRefundResult {
  code: string;
  state: string;
  providerRefundId?: string;
  /** HTTP status of the call — lets settlement distinguish a definitive 4xx
   *  rejection (→ FAILED, release the payment) from a 5xx/transient (→ PENDING). */
  httpStatus?: number;
  /** PhonePe top-level `success` flag, when present. */
  success?: boolean;
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
    const { json, httpStatus } = await this.post(`${base}/pg/v1/refund`, { request: base64 }, checksum);
    return this.parse(json, httpStatus);
  }

  async status(merchantRefundId: string): Promise<PhonepeRefundResult> {
    const { merchantId, saltKey, saltIndex, base } = this.creds();
    const path = `/pg/v1/status/${merchantId}/${merchantRefundId}`;
    const { json, httpStatus } = await this.get(`${base}${path}`, statusChecksum(path, saltKey, saltIndex), merchantId);
    return this.parse(json, httpStatus);
  }

  private parse(json: any, httpStatus: number): PhonepeRefundResult {
    return {
      code: json?.code ?? 'UNKNOWN',
      state: json?.data?.state ?? 'PENDING',
      providerRefundId: json?.data?.transactionId as string | undefined,
      httpStatus,
      success: typeof json?.success === 'boolean' ? json.success : undefined,
      raw: json,
    };
  }

  private async post(url: string, body: unknown, checksum: string): Promise<{ json: unknown; httpStatus: number }> {
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
    return { json: await r.json().catch(() => ({})), httpStatus: r.status };
  }

  private async get(url: string, checksum: string, merchantId: string): Promise<{ json: unknown; httpStatus: number }> {
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
    return { json: await r.json().catch(() => ({})), httpStatus: r.status };
  }
}
