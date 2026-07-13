/**
 * Checkout unit tests: the untrusted-cart WIRE invariant (Phase 5), the
 * DTO-keyed idempotency key, the error-reason-driven recovery classifier, and
 * the pre-pay cart deltas. Run:
 *   npx tsx --test src/lib/checkout.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from './api';
import { checkoutIdempotencyKey } from './checkout-idempotency';
import { classifyOrderError } from './checkout-recovery';
import { computeCartDeltas } from './checkout-deltas';
import type { CheckoutAddress } from '../types/order';
import type { CartLine } from '../types';

const DTO: CheckoutAddress = {
  fullName: 'Priya Sharma',
  phone: '9876543210',
  line1: '12 MG Road',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  country: 'IN',
  couponCode: 'WH25',
};

// ---------------------------------------------- Phase 5: the wire invariant

test('POST /orders sends ONLY address + couponCode (+ Idempotency-Key) on the wire', async () => {
  const orig = globalThis.fetch;
  let captured: { body: string; headers: Record<string, string> } | null = null;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    captured = { body: String(init.body), headers: init.headers as Record<string, string> };
    return new Response(
      JSON.stringify({ id: 'o1', number: 'WH-ABC123', status: 'PENDING', items: [] }),
      { status: 201, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;
  try {
    await api.orders.create(DTO, 'a'.repeat(24));
    assert.ok(captured, 'fetch was not called');
    const body = JSON.parse(captured!.body);
    const allowed = new Set(['fullName', 'phone', 'line1', 'line2', 'city', 'state', 'pincode', 'country', 'couponCode']);
    for (const k of Object.keys(body)) assert.ok(allowed.has(k), `unexpected key on the wire: ${k}`);
    for (const forbidden of ['price', 'total', 'subtotal', 'discount', 'tax', 'items', 'quantity', 'lineTotal', 'amount', 'amountMinor']) {
      assert.ok(!(forbidden in body), `forbidden money/line-item key reached the wire: ${forbidden}`);
    }
    const h = captured!.headers;
    assert.ok(h['Idempotency-Key'] ?? h['idempotency-key'], 'Idempotency-Key header missing');
  } finally {
    globalThis.fetch = orig;
  }
});

// -------------------------------------------- DTO-keyed idempotency key

test('idempotency key: stable for identical DTO, differs on edit, matches server regex', async () => {
  const k1 = await checkoutIdempotencyKey('attempt-1', DTO);
  const k2 = await checkoutIdempotencyKey('attempt-1', DTO);
  assert.equal(k1, k2, 'same attempt + same DTO must replay the same key');

  const edited = await checkoutIdempotencyKey('attempt-1', { ...DTO, line1: '99 Other Road' });
  assert.notEqual(k1, edited, 'an edited address must produce a different key (new order)');

  const stripped = await checkoutIdempotencyKey('attempt-1', { ...DTO, couponCode: undefined });
  assert.notEqual(k1, stripped, 'dropping the coupon must change the key');

  const otherAttempt = await checkoutIdempotencyKey('attempt-2', DTO);
  assert.notEqual(k1, otherAttempt);

  assert.match(k1, /^[a-z0-9_-]{8,64}$/i);
});

// ----------------------------------------- error-reason-driven recovery

test('order-error classifier maps each createFromCart throw kind distinctly', () => {
  assert.equal(classifyOrderError(409, 'Only 3 of Neem Face Wash left — please reduce the quantity', false).kind, 'reduce-quantity');
  assert.equal(classifyOrderError(409, 'Neem Face Wash is out of stock', false).kind, 'reduce-quantity');
  assert.equal(classifyOrderError(400, 'A product in your cart is no longer available', false).kind, 'remove-line');
  assert.equal(classifyOrderError(400, 'Cart is empty', false).kind, 'empty-cart');
  assert.equal(classifyOrderError(400, 'This coupon has expired', true).kind, 'strip-coupon');
  assert.equal(classifyOrderError(400, 'Some opaque coupon reason', true).kind, 'strip-coupon'); // 400 + hadCoupon
  assert.equal(classifyOrderError(409, 'Stock changed concurrently — please retry', false).kind, 'retry');
  assert.equal(classifyOrderError(500, 'boom', false).kind, 'unknown');
});

test('a stock/availability error is NOT misread as a coupon failure even with a coupon applied', () => {
  // hadCoupon=true, but the message is a stock error → must reduce, not strip-coupon.
  assert.equal(classifyOrderError(409, 'Only 1 of X left — please reduce the quantity', true).kind, 'reduce-quantity');
});

// -------------------------------------------------- pre-pay cart deltas

const line = (id: string, unit: number, qty: number): CartLine => ({
  productId: id,
  slug: id,
  name: `P-${id}`,
  thumbnail: '',
  unitPrice: { amount: unit, currency: 'INR' },
  quantity: qty,
  lineTotal: { amount: unit * qty, currency: 'INR' },
});

test('cart deltas surface removed / quantity-reduced / price-changed', () => {
  const client = [line('a', 100, 3), line('b', 200, 1), line('c', 50, 2)];
  const server = [line('b', 250, 1), line('c', 50, 1)]; // a removed, b price↑, c reduced
  const deltas = computeCartDeltas(client, server);
  const byId = new Map(deltas.map((d) => [d.productId, d.kind]));
  assert.equal(byId.get('a'), 'removed');
  assert.equal(byId.get('b'), 'price-changed');
  assert.equal(byId.get('c'), 'quantity-reduced');
});

test('no deltas when the client and server carts already agree (post-Phase-3 norm)', () => {
  const same = [line('a', 100, 2), line('b', 200, 1)];
  assert.deepEqual(computeCartDeltas(same, same), []);
});
