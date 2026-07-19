/**
 * Razorpay Standard Checkout (checkout.js) loader + opener.
 *
 * The script is injected once and cached. `openRazorpayCheckout` opens the modal
 * with the SERVER-derived `order_id` — with an order_id present, Razorpay derives
 * the authoritative charge from the server-side order, so the amount passed here
 * is display-only. `handler` (a required option) receives the success tuple the
 * client hands to `POST /razorpay/verify`; `modal.ondismiss` fires on cancel.
 */

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (resp: unknown) => void) => void;
}
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

let loadPromise: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Razorpay unavailable (SSR)'));
  if (window.Razorpay) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null; // allow a retry
      reject(new Error('Could not load the payment window. Check your connection and try again.'));
    };
    document.body.appendChild(script);
  });
  return loadPromise;
}

export interface RazorpayHandlerResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailureResponse {
  error?: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: {
      order_id?: string;
      payment_id?: string;
    };
  };
}

/** Keep gateway details out of the UI while still giving the shopper a clear recovery path. */
export function razorpayFailureMessage(_response: RazorpayFailureResponse): string {
  return 'Your payment was not completed. No successful payment has been confirmed — please try again or choose another payment method.';
}

export interface OpenCheckoutOptions {
  keyId: string;
  razorpayOrderId: string;
  amountMinor: number;
  currency: string;
  orderNumber: string;
  prefill?: { name?: string; contact?: string; email?: string };
  onSuccess: (resp: RazorpayHandlerResponse) => void;
  onFailure: (resp: RazorpayFailureResponse) => void;
  onDismiss: () => void;
}

export async function openRazorpayCheckout(opts: OpenCheckoutOptions): Promise<void> {
  await loadRazorpay();
  const Ctor = window.Razorpay;
  if (!Ctor) throw new Error('Razorpay failed to initialise');
  const rzp = new Ctor({
    key: opts.keyId,
    order_id: opts.razorpayOrderId,
    amount: opts.amountMinor, // display only — order_id is authoritative
    currency: opts.currency,
    name: 'Wood House Herbals',
    description: `Order ${opts.orderNumber}`,
    prefill: opts.prefill ?? {},
    theme: { color: '#5fa430' },
    handler: (resp: unknown) => opts.onSuccess(resp as RazorpayHandlerResponse),
    modal: { ondismiss: () => opts.onDismiss(), confirm_close: true },
  });
  rzp.on('payment.failed', (resp) => opts.onFailure(resp as RazorpayFailureResponse));
  rzp.open();
}
