import type { RazorpayPaymentEntity } from './razorpay-states';

/**
 * Contains[]-driven webhook envelope parser. Pure, never throws.
 *
 * Envelope (Appendix B-3): { entity:'event', event, contains:[…],
 * payload:{ <entityKey>:{ entity:{…} } } }. Routing reads the PAYLOAD, not
 * the event-name string: refund events carry both refund and payment
 * entities (refund routes); order.paid carries payment + order (payment
 * routes); anything without a payment/refund entity is 'unknown' — the
 * caller acks 200 and logs, because an unhandled event must never make the
 * provider retry forever.
 */

export interface RazorpayRefundEntity {
  id: string;
  status: string;
  amount: number;
  payment_id: string;
  receipt?: string | null;
}

export type ParsedWebhook =
  | { kind: 'payment'; event: string; payment: RazorpayPaymentEntity }
  | {
      kind: 'refund';
      event: string;
      refund: RazorpayRefundEntity;
      payment?: RazorpayPaymentEntity;
    }
  | { kind: 'unknown'; event?: string };

function entityOf(payload: unknown, key: string): Record<string, unknown> | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const wrapper = (payload as Record<string, unknown>)[key];
  if (typeof wrapper !== 'object' || wrapper === null) return undefined;
  const entity = (wrapper as Record<string, unknown>).entity;
  if (typeof entity !== 'object' || entity === null) return undefined;
  return entity as Record<string, unknown>;
}

function isPayment(e: Record<string, unknown> | undefined): e is Record<string, unknown> {
  return (
    !!e && typeof e.id === 'string' && typeof e.status === 'string' && typeof e.amount === 'number'
  );
}

export function parseWebhookEnvelope(raw: unknown): ParsedWebhook {
  if (typeof raw !== 'object' || raw === null) return { kind: 'unknown' };
  const envelope = raw as Record<string, unknown>;
  const event = typeof envelope.event === 'string' ? envelope.event : undefined;
  const payload = envelope.payload;

  const refund = entityOf(payload, 'refund');
  if (refund && typeof refund.id === 'string' && typeof refund.status === 'string') {
    const payment = entityOf(payload, 'payment');
    return {
      kind: 'refund',
      event: event ?? 'unknown',
      refund: refund as unknown as RazorpayRefundEntity,
      ...(isPayment(payment) ? { payment: payment as unknown as RazorpayPaymentEntity } : {}),
    };
  }

  const payment = entityOf(payload, 'payment');
  if (isPayment(payment)) {
    return {
      kind: 'payment',
      event: event ?? 'unknown',
      payment: payment as unknown as RazorpayPaymentEntity,
    };
  }

  return event === undefined ? { kind: 'unknown' } : { kind: 'unknown', event };
}
