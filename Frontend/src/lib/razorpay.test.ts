import test from 'node:test';
import assert from 'node:assert/strict';
import {
  openRazorpayCheckout,
  razorpayFailureMessage,
  type RazorpayFailureResponse,
} from './razorpay';

test('Standard Checkout registers payment.failed before opening the modal', async () => {
  let opened = false;
  let failureHandler: ((response: unknown) => void) | undefined;
  let received: RazorpayFailureResponse | undefined;

  class FakeRazorpay {
    constructor(_options: Record<string, unknown>) {}
    on(event: string, callback: (response: unknown) => void) {
      if (event === 'payment.failed') failureHandler = callback;
    }
    open() {
      opened = true;
    }
  }

  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { Razorpay: FakeRazorpay },
  });

  try {
    await openRazorpayCheckout({
      keyId: 'rzp_test_public',
      razorpayOrderId: 'order_test',
      amountMinor: 100,
      currency: 'INR',
      orderNumber: 'WH-ABC123',
      onSuccess: () => {},
      onFailure: (response) => {
        received = response;
      },
      onDismiss: () => {},
    });

    assert.equal(opened, true);
    assert.ok(failureHandler, 'payment.failed listener was not registered');
    const failure = { error: { code: 'BAD_REQUEST_ERROR', reason: 'payment_failed' } };
    failureHandler(failure);
    assert.deepEqual(received, failure);
  } finally {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  }
});

test('payment failures use a safe, actionable shopper message', () => {
  const message = razorpayFailureMessage({
    error: {
      description: 'provider detail',
      metadata: { order_id: 'order_private', payment_id: 'pay_private' },
    },
  });
  assert.match(message, /not completed/i);
  assert.match(message, /try again/i);
  assert.doesNotMatch(message, /provider detail|order_private|pay_private/);
});
