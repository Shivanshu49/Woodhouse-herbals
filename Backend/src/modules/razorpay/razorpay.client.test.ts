/**
 * Tests for the Razorpay S2S client (plan Phase 3; Appendix B-1/B-4).
 *
 * The fetch function is constructor-injected so every wire detail is
 * assertable without network: Basic auth construction, the nested
 * auto-capture object, the X-Refund-Idempotency header, and the four
 * refund-create outcomes (ok / 409-in-flight / definitive-4xx / transient)
 * that decideRefundSweep consumes. Network errors THROW (callers map them
 * to PENDING — never-guess); HTTP outcomes never throw.
 *
 * Run: npx tsx --test src/modules/razorpay/razorpay.client.test.ts
 */

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetEnvCacheForTests } from '../../common/config/env';
import { RazorpayClient, RazorpayHttpError } from './razorpay.client';

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://x:x@localhost:5432/x';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(64);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(64);
  process.env.RAZORPAY_KEY_ID = 'rzp_test_keyid';
  process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
  resetEnvCacheForTests();
});

interface Captured {
  url: string;
  init: RequestInit;
}

function makeClient(responses: Array<{ status: number; body: unknown }>) {
  const captured: Captured[] = [];
  let call = 0;
  const fetchFn = (async (url: string, init: RequestInit) => {
    captured.push({ url, init });
    const r = responses[Math.min(call++, responses.length - 1)]!;
    return {
      status: r.status,
      ok: r.status >= 200 && r.status < 300,
      json: async () => r.body,
    };
  }) as unknown as typeof fetch;
  return { client: new RazorpayClient(fetchFn), captured };
}

test('every call carries Basic auth over key_id:key_secret', async () => {
  const { client, captured } = makeClient([{ status: 200, body: { id: 'order_A' } }]);
  await client.createOrder({ amountMinor: 49900, receipt: 'WH-A-12345678' });
  const auth = (captured[0]!.init.headers as Record<string, string>).Authorization;
  assert.equal(auth, `Basic ${Buffer.from('rzp_test_keyid:rzp_test_secret').toString('base64')}`);
});

test('createOrder: POST /v1/orders with paise amount, INR, receipt, and the NESTED auto-capture object', async () => {
  const { client, captured } = makeClient([{ status: 200, body: { id: 'order_A' } }]);
  const created = await client.createOrder({
    amountMinor: 49900,
    receipt: 'WH-ABC123-abcd1234',
    notes: { orderNumber: 'WH-ABC123' },
  });
  assert.equal(created.id, 'order_A');
  assert.equal(captured[0]!.url, 'https://api.razorpay.com/v1/orders');
  const body = JSON.parse(captured[0]!.init.body as string);
  assert.equal(body.amount, 49900);
  assert.equal(body.currency, 'INR');
  assert.equal(body.receipt, 'WH-ABC123-abcd1234');
  // Appendix B-1: legacy payment_capture is undocumented — the 2026 mechanism.
  assert.deepEqual(body.payment, {
    capture: 'automatic',
    capture_options: { automatic_expiry_period: 12, refund_speed: 'normal' },
  });
  assert.equal('payment_capture' in body, false);
});

test('createOrder: a non-2xx response throws with the status, never with secrets', async () => {
  const { client } = makeClient([
    { status: 401, body: { error: { code: 'BAD_REQUEST_ERROR', description: 'auth' } } },
  ]);
  await assert.rejects(
    () => client.createOrder({ amountMinor: 100, receipt: 'r-1234567890' }),
    (e: Error) => {
      assert.ok(e instanceof RazorpayHttpError);
      assert.equal(e.httpStatus, 401);
      assert.match(e.message, /401/);
      assert.doesNotMatch(e.message, /rzp_test_secret/);
      return true;
    },
  );
});

test('createOrder: rejects an amount below Razorpay\'s 100-paise minimum before IO', async () => {
  const { client, captured } = makeClient([{ status: 200, body: { id: 'order_A' } }]);
  await assert.rejects(
    () => client.createOrder({ amountMinor: 99, receipt: 'r-1234567890' }),
    /at least 100 paise/i,
  );
  assert.equal(captured.length, 0);
});

test('fetchOrderPayments: GET /v1/orders/:id/payments returns the attempt list', async () => {
  const items = [{ id: 'pay_1', status: 'captured', amount: 49900, order_id: 'order_A' }];
  const { client, captured } = makeClient([{ status: 200, body: { count: 1, items } }]);
  const attempts = await client.fetchOrderPayments('order_A');
  assert.equal(captured[0]!.url, 'https://api.razorpay.com/v1/orders/order_A/payments');
  assert.deepEqual(attempts, items);
});

test('fetchPayment: GET /v1/payments/:id returns the entity', async () => {
  const entity = { id: 'pay_1', status: 'captured', amount: 49900, order_id: 'order_A' };
  const { client, captured } = makeClient([{ status: 200, body: entity }]);
  assert.deepEqual(await client.fetchPayment('pay_1'), entity);
  assert.equal(captured[0]!.url, 'https://api.razorpay.com/v1/payments/pay_1');
});

test('createRefund: sends the X-Refund-Idempotency header AND the receipt (dual dedupe)', async () => {
  const refund = { id: 'rfnd_1', status: 'pending', amount: 49900, payment_id: 'pay_1' };
  const { client, captured } = makeClient([{ status: 200, body: refund }]);
  const result = await client.createRefund({
    paymentId: 'pay_1',
    idempotencyKey: 'RFclx0987654321',
    receipt: 'RFclx0987654321',
    amountMinor: 49900,
  });
  assert.deepEqual(result, { outcome: 'ok', refund, httpStatus: 200 });
  assert.equal(captured[0]!.url, 'https://api.razorpay.com/v1/payments/pay_1/refund');
  const headers = captured[0]!.init.headers as Record<string, string>;
  assert.equal(headers['X-Refund-Idempotency'], 'RFclx0987654321');
  const body = JSON.parse(captured[0]!.init.body as string);
  assert.equal(body.receipt, 'RFclx0987654321');
  assert.equal(body.amount, 49900, 'the full-order amount is asserted explicitly on the wire');
});

test('createRefund: 409 (idempotent retry racing the in-flight original) is its own outcome', async () => {
  const { client } = makeClient([{ status: 409, body: {} }]);
  const result = await client.createRefund({
    paymentId: 'pay_1',
    idempotencyKey: 'RFclx0987654321',
    receipt: 'RFclx0987654321',
    amountMinor: 49900,
  });
  assert.deepEqual(result, { outcome: 'in-flight-409', httpStatus: 409 });
});

test('createRefund: 4xx carries the error envelope through (code/reason/description) — no string matching here', async () => {
  const { client } = makeClient([
    {
      status: 400,
      body: {
        error: {
          code: 'BAD_REQUEST_ERROR',
          reason: 'duplicate_receipt',
          description: 'Duplicate receipt found for this refund request',
        },
      },
    },
  ]);
  const result = await client.createRefund({
    paymentId: 'pay_1',
    idempotencyKey: 'RFclx0987654321',
    receipt: 'RFclx0987654321',
    amountMinor: 49900,
  });
  assert.deepEqual(result, {
    outcome: 'definitive-4xx',
    httpStatus: 400,
    errorCode: 'BAD_REQUEST_ERROR',
    reason: 'duplicate_receipt',
    description: 'Duplicate receipt found for this refund request',
  });
});

test('createRefund: 5xx is transient (caller keeps the refund PENDING)', async () => {
  const { client } = makeClient([{ status: 502, body: {} }]);
  const result = await client.createRefund({
    paymentId: 'pay_1',
    idempotencyKey: 'RFclx0987654321',
    receipt: 'RFclx0987654321',
    amountMinor: 49900,
  });
  assert.deepEqual(result, { outcome: 'transient', httpStatus: 502 });
});

test('CP4-FIX: throttle/transport 4xx (429, 408) are TRANSIENT — they carry no refund-layer verdict', async () => {
  for (const status of [429, 408, 425]) {
    const { client } = makeClient([{ status, body: { error: { code: 'BAD_REQUEST_ERROR' } } }]);
    const result = await client.createRefund({
      paymentId: 'pay_1',
      idempotencyKey: 'RFk1234567890',
      receipt: 'RFk1234567890',
      amountMinor: 49900,
    });
    assert.deepEqual(result, { outcome: 'transient', httpStatus: status }, `status ${status}`);
  }
});

test('CP4-FIX: an envelope-less 4xx (edge/WAF/CDN, no error.code) is TRANSIENT, not definitive', async () => {
  const { client } = makeClient([{ status: 403, body: '<html>blocked</html>' }]);
  const result = await client.createRefund({
    paymentId: 'pay_1',
    idempotencyKey: 'RFk1234567890',
    receipt: 'RFk1234567890',
    amountMinor: 49900,
  });
  assert.deepEqual(result, { outcome: 'transient', httpStatus: 403 });
});

test('CP4-FIX: a 400 WITH a Razorpay error envelope stays definitive-4xx (a real refund-layer rejection)', async () => {
  const { client } = makeClient([
    { status: 400, body: { error: { code: 'BAD_REQUEST_ERROR', reason: 'excess_amount' } } },
  ]);
  const result = await client.createRefund({
    paymentId: 'pay_1',
    idempotencyKey: 'RFk1234567890',
    receipt: 'RFk1234567890',
    amountMinor: 49900,
  });
  assert.equal(result.outcome, 'definitive-4xx');
});

test('fetchRefund: 404 returns null (refund provably absent), 200 returns the entity', async () => {
  const entity = { id: 'rfnd_1', status: 'processed', amount: 100, payment_id: 'pay_1' };
  const { client: c404 } = makeClient([{ status: 404, body: {} }]);
  assert.equal(await c404.fetchRefund('rfnd_1'), null);
  const { client: c200 } = makeClient([{ status: 200, body: entity }]);
  assert.deepEqual(await c200.fetchRefund('rfnd_1'), entity);
});

test('listRefundsForPayment: GET /v1/payments/:id/refunds returns items', async () => {
  const items = [{ id: 'rfnd_1', status: 'pending', amount: 100, payment_id: 'pay_1', receipt: 'RFx' }];
  const { client, captured } = makeClient([{ status: 200, body: { count: 1, items } }]);
  assert.deepEqual(await client.listRefundsForPayment('pay_1'), items);
  assert.equal(captured[0]!.url, 'https://api.razorpay.com/v1/payments/pay_1/refunds');
});

test('every request carries a timeout signal (15s budget)', async () => {
  const { client, captured } = makeClient([{ status: 200, body: { id: 'order_A' } }]);
  await client.createOrder({ amountMinor: 100, receipt: 'r-1234567890' });
  assert.ok(captured[0]!.init.signal instanceof AbortSignal);
});

test('unconfigured keys throw a plain error (the service 503s before ever calling)', async () => {
  process.env.RAZORPAY_KEY_ID = '';
  process.env.RAZORPAY_KEY_SECRET = '';
  resetEnvCacheForTests();
  const { client } = makeClient([{ status: 200, body: {} }]);
  await assert.rejects(() => client.createOrder({ amountMinor: 100, receipt: 'r-1234567890' }), {
    message: /not configured/i,
  });
});
