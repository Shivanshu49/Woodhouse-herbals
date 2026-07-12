/**
 * Tests for the contains[]-driven webhook envelope parser (plan §1.1[5];
 * Appendix B-3).
 *
 * Razorpay envelope: { entity:'event', event, contains:[…],
 * payload:{ <entity>:{ entity:{…} } } }. Parsing is driven by contains[] +
 * payload keys, NEVER by the event-name string — payment.captured /
 * payment.authorized / order.paid may all carry the money-relevant payment
 * entity, and the sequence is not fixed.
 *
 * Run: npx tsx --test src/modules/razorpay/razorpay-webhook-router.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWebhookEnvelope } from './razorpay-webhook-router';

const paymentEntity = { id: 'pay_1', status: 'captured', amount: 100, order_id: 'order_A' };
const refundEntity = { id: 'rfnd_1', status: 'processed', amount: 100, payment_id: 'pay_1', receipt: 'RFabc' };
const orderEntity = { id: 'order_A', status: 'paid', amount: 100 };

const envelope = (event: string, contains: string[], payload: Record<string, unknown>) =>
  JSON.parse(
    JSON.stringify({
      entity: 'event',
      account_id: 'acc_x',
      event,
      contains,
      payload,
      created_at: 1752384000,
    }),
  );

test('payment.captured ⇒ kind payment with the entity extracted', () => {
  const parsed = parseWebhookEnvelope(
    envelope('payment.captured', ['payment'], { payment: { entity: paymentEntity } }),
  );
  assert.deepEqual(parsed, { kind: 'payment', event: 'payment.captured', payment: paymentEntity });
});

test('refund events carry BOTH entities — refund takes routing precedence', () => {
  const parsed = parseWebhookEnvelope(
    envelope('refund.processed', ['refund', 'payment'], {
      refund: { entity: refundEntity },
      payment: { entity: paymentEntity },
    }),
  );
  assert.deepEqual(parsed, {
    kind: 'refund',
    event: 'refund.processed',
    refund: refundEntity,
    payment: paymentEntity,
  });
});

test('order.paid carries payment + order — routed as a payment settle trigger', () => {
  const parsed = parseWebhookEnvelope(
    envelope('order.paid', ['payment', 'order'], {
      payment: { entity: paymentEntity },
      order: { entity: orderEntity },
    }),
  );
  assert.equal(parsed.kind, 'payment');
  assert.deepEqual((parsed as { payment: unknown }).payment, paymentEntity);
});

test('routing is contains/payload-driven, not event-name-driven', () => {
  // A hypothetical/renamed event whose payload clearly carries a refund
  // entity must still route as a refund.
  const parsed = parseWebhookEnvelope(
    envelope('refund.speed_changed', ['refund', 'payment'], {
      refund: { entity: { ...refundEntity, status: 'pending' } },
      payment: { entity: paymentEntity },
    }),
  );
  assert.equal(parsed.kind, 'refund');
});

test('an event with no payment/refund entity ⇒ kind unknown (ack + log)', () => {
  const parsed = parseWebhookEnvelope(
    envelope('invoice.paid', ['invoice'], { invoice: { entity: { id: 'inv_1' } } }),
  );
  assert.deepEqual(parsed, { kind: 'unknown', event: 'invoice.paid' });
});

test('REVIEW-FIX: a payment entity WITHOUT order_id (Payment Links etc.) is unknown, not a poison claim', () => {
  // Without this, `providerTxnId: undefined` would throw a Prisma validation
  // error in the settlement lookup and markFailed the claim forever.
  const { order_id: _dropped, ...noOrderId } = paymentEntity;
  const parsed = parseWebhookEnvelope(
    envelope('payment.captured', ['payment'], { payment: { entity: noOrderId } }),
  );
  assert.equal(parsed.kind, 'unknown');
});

test('malformed envelopes (missing payload / non-object / wrong nesting) ⇒ unknown, never throw', () => {
  assert.equal(parseWebhookEnvelope({}).kind, 'unknown');
  assert.equal(parseWebhookEnvelope(null).kind, 'unknown');
  assert.equal(parseWebhookEnvelope('str').kind, 'unknown');
  assert.equal(
    parseWebhookEnvelope(envelope('payment.captured', ['payment'], { payment: {} })).kind,
    'unknown',
  );
});
