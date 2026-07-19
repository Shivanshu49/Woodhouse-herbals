import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { env } from '../../common/config/env';
import type { RazorpayPaymentEntity } from './razorpay-states';
import type { RazorpayRefundEntity } from './razorpay-webhook-router';

const BASE = 'https://api.razorpay.com';
const TIMEOUT_MS = 15_000;

/**
 * Razorpay S2S client — signed IO only, all settlement decisions live with
 * the callers (a signed-IO client; all settlement decisions live upstream).
 *
 * - Basic auth `key_id:key_secret` (Appendix B-1); NO request signing.
 * - Auto-capture via the NESTED payment object — the legacy top-level
 *   `payment_capture` param is no longer documented (Appendix B-1; user
 *   decision #1).
 * - Refund create sends BOTH the X-Refund-Idempotency header (replay-safe
 *   retries) and the deterministic receipt (reject-not-replay second net) —
 *   Appendix B-4.
 * - HTTP outcomes never throw (they are data for decideRefundSweep);
 *   network/timeout errors DO throw — callers map them to PENDING, never
 *   guessing that money moved.
 * - NEVER logs secrets, auth headers, or response bodies.
 */
/** DI token for overriding fetch in tests; unset in production. */
export const RAZORPAY_FETCH = 'RAZORPAY_FETCH';

/** Status-only provider error: safe to classify without retaining Razorpay's response body. */
export class RazorpayHttpError extends Error {
  constructor(readonly httpStatus: number, operation: string) {
    super(`Razorpay ${operation} failed (HTTP ${httpStatus})`);
    this.name = 'RazorpayHttpError';
  }
}

@Injectable()
export class RazorpayClient {
  private readonly logger = new Logger(RazorpayClient.name);
  private readonly fetchFn: typeof fetch;

  // A bare `fetchFn = globalThis.fetch` param would emit `Function` into the
  // compiled design:paramtypes and Nest would refuse to boot ("can't resolve
  // dependencies of RazorpayClient"); @Optional + an explicit token keeps
  // the class constructible under DI (prod) AND under plain `new` (tests).
  constructor(@Optional() @Inject(RAZORPAY_FETCH) fetchFn?: typeof fetch) {
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  isConfigured(): boolean {
    return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
  }

  private authHeader(): string {
    if (!this.isConfigured()) {
      // The service layer 503s before calling; this is a programmer-error net.
      throw new Error('Razorpay client is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)');
    }
    const token = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString(
      'base64',
    );
    return `Basic ${token}`;
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<{ httpStatus: number; json: unknown }> {
    const headers: Record<string, string> = {
      Authorization: this.authHeader(),
      accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    };
    const res = await this.fetchFn(`${BASE}${path}`, {
      method,
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json().catch(() => ({}));
    this.logger.log(JSON.stringify({ scope: 'razorpay:s2s', method, path, status: res.status }));
    return { httpStatus: res.status, json };
  }

  // ── orders ────────────────────────────────────────────────────────────────

  async createOrder(input: {
    amountMinor: number;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<{ id: string; raw: unknown }> {
    if (!Number.isInteger(input.amountMinor) || input.amountMinor < 100) {
      throw new Error('Razorpay order amount must be an integer of at least 100 paise');
    }
    const { httpStatus, json } = await this.request('POST', '/v1/orders', {
      amount: input.amountMinor,
      currency: 'INR',
      receipt: input.receipt,
      ...(input.notes ? { notes: input.notes } : {}),
      payment: {
        capture: 'automatic',
        capture_options: { automatic_expiry_period: 12, refund_speed: 'normal' },
      },
    });
    const id = (json as { id?: string } | null)?.id;
    if (httpStatus < 200 || httpStatus >= 300 || !id) {
      throw new RazorpayHttpError(httpStatus, 'order create');
    }
    return { id, raw: json };
  }

  /** Every attempt (incl. failed ones) against an rzp order — the cron's ground truth. */
  async fetchOrderPayments(rzpOrderId: string): Promise<RazorpayPaymentEntity[]> {
    const { httpStatus, json } = await this.request(
      'GET',
      `/v1/orders/${encodeURIComponent(rzpOrderId)}/payments`,
    );
    if (httpStatus < 200 || httpStatus >= 300) {
      throw new Error(`Razorpay order-payments fetch failed (HTTP ${httpStatus})`);
    }
    return ((json as { items?: RazorpayPaymentEntity[] } | null)?.items ?? []) as RazorpayPaymentEntity[];
  }

  // ── payments ──────────────────────────────────────────────────────────────

  async fetchPayment(paymentId: string): Promise<RazorpayPaymentEntity> {
    const { httpStatus, json } = await this.request(
      'GET',
      `/v1/payments/${encodeURIComponent(paymentId)}`,
    );
    if (httpStatus < 200 || httpStatus >= 300) {
      throw new Error(`Razorpay payment fetch failed (HTTP ${httpStatus})`);
    }
    return json as RazorpayPaymentEntity;
  }

  // ── refunds ───────────────────────────────────────────────────────────────

  async createRefund(input: {
    paymentId: string;
    /** Deterministic per refund row — replay-safe retries (Appendix B-4). */
    idempotencyKey: string;
    /** Same value as receipt: the payment-scoped reject-not-replay net. */
    receipt: string;
    /** Explicit paise amount — asserts our full-order expectation instead of
     *  relying on the omitted-amount default; a drifted expectation is then
     *  a provider-side arithmetic rejection, not a silent partial refund. */
    amountMinor: number;
    notes?: Record<string, string>;
  }): Promise<RefundCreateResult> {
    const { httpStatus, json } = await this.request(
      'POST',
      `/v1/payments/${encodeURIComponent(input.paymentId)}/refund`,
      {
        amount: input.amountMinor,
        receipt: input.receipt,
        ...(input.notes ? { notes: input.notes } : {}),
      },
      { 'X-Refund-Idempotency': input.idempotencyKey },
    );
    if (httpStatus >= 200 && httpStatus < 300) {
      return { outcome: 'ok', refund: json as RazorpayRefundEntity, httpStatus };
    }
    if (httpStatus === 409) return { outcome: 'in-flight-409', httpStatus };
    const err = (json as { error?: { code?: string; reason?: string; description?: string } })
      ?.error;
    // 'definitive-4xx' is one of the TWO evidence legs of conclude-FAILED — it
    // must mean "Razorpay's refund logic rejected this", NOT "the request never
    // reached it". Throttle/transport 4xx (408 timeout, 425 too-early, 429 rate
    // limit) and any envelope-less 4xx (edge/WAF/CDN — api.razorpay.com is
    // proxied) carry no refund-layer verdict, so they are TRANSIENT. Only a 4xx
    // that carries a Razorpay error envelope is definitive. (CP4 review, medium.)
    const TRANSPORT_4XX = new Set([408, 425, 429]);
    if (httpStatus >= 400 && httpStatus < 500 && err?.code && !TRANSPORT_4XX.has(httpStatus)) {
      return {
        outcome: 'definitive-4xx',
        httpStatus,
        errorCode: err.code,
        reason: err.reason,
        description: err.description,
      };
    }
    return { outcome: 'transient', httpStatus };
  }

  /** null = provably absent (404) — positive evidence for the conclude rule. */
  async fetchRefund(refundId: string): Promise<RazorpayRefundEntity | null> {
    const { httpStatus, json } = await this.request(
      'GET',
      `/v1/refunds/${encodeURIComponent(refundId)}`,
    );
    if (httpStatus === 404) return null;
    if (httpStatus < 200 || httpStatus >= 300) {
      throw new Error(`Razorpay refund fetch failed (HTTP ${httpStatus})`);
    }
    return json as RazorpayRefundEntity;
  }

  async listRefundsForPayment(paymentId: string): Promise<RazorpayRefundEntity[]> {
    const { httpStatus, json } = await this.request(
      'GET',
      `/v1/payments/${encodeURIComponent(paymentId)}/refunds`,
    );
    if (httpStatus < 200 || httpStatus >= 300) {
      throw new Error(`Razorpay refund list failed (HTTP ${httpStatus})`);
    }
    return ((json as { items?: RazorpayRefundEntity[] } | null)?.items ?? []) as RazorpayRefundEntity[];
  }
}

export type RefundCreateResult =
  | { outcome: 'ok'; refund: RazorpayRefundEntity; httpStatus: number }
  | { outcome: 'in-flight-409'; httpStatus: 409 }
  | {
      outcome: 'definitive-4xx';
      httpStatus: number;
      errorCode?: string;
      reason?: string;
      description?: string;
    }
  | { outcome: 'transient'; httpStatus: number };
