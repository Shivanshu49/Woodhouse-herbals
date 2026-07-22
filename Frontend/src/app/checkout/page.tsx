'use client';

// Needs the live server cart + guest session cookie; never statically rendered.
export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, ArrowRight, AlertTriangle, Loader2, ShoppingBag } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useCartStore } from '@/store/cart';
import { AddressForm } from '@/components/checkout/AddressForm';
import { SavedAddressSelector, type SavedAddressStatus } from '@/components/checkout/SavedAddressSelector';
import { useProfile } from '@/hooks/use-auth';
import { computeCartDeltas } from '@/lib/checkout-deltas';
import { classifyOrderError, type RecoveryAction } from '@/lib/checkout-recovery';
import { checkoutIdempotencyKey } from '@/lib/checkout-idempotency';
import { openRazorpayCheckout, razorpayFailureMessage } from '@/lib/razorpay';
import { emptyCheckoutAddress, preferredSavedAddress, savedAddressToCheckout } from '@/lib/saved-addresses';
import type { CheckoutAddress, Order } from '@/types/order';
import type { CustomerAddress } from '@/types/auth';

const inr = (minor: number) =>
  `₹${(minor / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

type Phase =
  | { name: 'review' }
  | { name: 'address' }
  | { name: 'placing' }
  | { name: 'recovery'; action: RecoveryAction }
  | { name: 'confirm'; order: Order; notice?: { kind: 'cancelled' | 'failed'; message: string } }
  | { name: 'paying'; order: Order }
  | { name: 'error'; message: string };

export default function CheckoutPage() {
  const router = useRouter();
  const clientLines = useCartStore((s) => s.lines);
  const [phase, setPhase] = useState<Phase>({ name: 'review' });
  const [acked, setAcked] = useState(false);
  const [addressChoice, setAddressChoice] = useState<string | 'manual' | null>(null);
  const addressChoiceInitializedRef = useRef(false);
  const addressChoiceTouchedRef = useRef(false);
  const attemptIdRef = useRef<string | null>(null);
  const lastDtoRef = useRef<CheckoutAddress | null>(null);
  const draftRef = useRef<CheckoutAddress | null>(null);
  const paymentFailureRef = useRef<string | null>(null);

  // Per-checkout-attempt id, persisted for the TAB so a page RELOAD replays the
  // same Idempotency-Key: an identical resubmit then returns the already-created
  // order instead of minting a DUPLICATE (which would double-decrement stock and,
  // since it never reaches /razorpay/initiate, leaves a Payment-less PENDING order
  // no reconciliation sweep restocks — a phantom stock leak). Cleared on payment
  // success so the next checkout is a fresh attempt.
  const getAttemptId = () => {
    if (attemptIdRef.current) return attemptIdRef.current;
    let id: string | null = null;
    try {
      id = sessionStorage.getItem('wh-checkout-attempt');
    } catch {
      /* storage blocked — fall back to in-memory */
    }
    if (!id) {
      id = crypto.randomUUID();
      try {
        sessionStorage.setItem('wh-checkout-attempt', id);
      } catch {
        /* ignore */
      }
    }
    attemptIdRef.current = id;
    return id;
  };

  const cartQuery = useQuery({
    queryKey: ['checkout-cart'],
    queryFn: () => api.cart.get(),
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Authentication/profile discovery is shared with the header, and the
  // profile already contains the address book. Account address mutations
  // invalidate this query, so using it here avoids a duplicate /customers/me
  // request while still reflecting address-book edits.
  const profileQuery = useProfile();
  const savedAddresses = profileQuery.data?.addresses ?? [];
  const requestedAddressChoice = addressChoice ?? 'manual';
  const selectedSavedAddress = savedAddresses.find((address) => address.id === requestedAddressChoice);
  const savedAddressStatus: SavedAddressStatus =
    profileQuery.isPending ||
    (profileQuery.isFetching && !profileQuery.data)
      ? 'loading'
      : profileQuery.isError
        ? 'error'
        : !profileQuery.data
          ? 'signed-out'
          : savedAddresses.length === 0
            ? 'empty'
            : 'ready';
  const selectedAddressMissing =
    addressChoice !== null &&
    addressChoice !== 'manual' &&
    savedAddressStatus !== 'loading' &&
    savedAddressStatus !== 'error' &&
    !selectedSavedAddress;
  const selectedAddressChoice = selectedAddressMissing ? 'manual' : requestedAddressChoice;

  // Commit the preferred address only once, after the initial profile/address
  // lookup settles. A customer who starts typing or explicitly chooses manual
  // checkout while that request is in flight must never have their work replaced.
  useEffect(() => {
    if (
      addressChoiceInitializedRef.current ||
      addressChoiceTouchedRef.current ||
      savedAddressStatus === 'loading'
    ) {
      return;
    }

    addressChoiceInitializedRef.current = true;
    const preferredAddress = preferredSavedAddress(savedAddresses);
    if (savedAddressStatus === 'ready' && preferredAddress) {
      setAddressChoice(preferredAddress.id);
      draftRef.current = savedAddressToCheckout(preferredAddress, draftRef.current?.couponCode);
      return;
    }

    setAddressChoice('manual');
    draftRef.current ??= emptyCheckoutAddress();
  }, [savedAddresses, savedAddressStatus]);

  // If a selected address is removed from the address book during a refetch,
  // do not leave its old snapshot silently editable as though it were manual.
  useEffect(() => {
    if (!selectedAddressMissing) return;
    setAddressChoice('manual');
    draftRef.current = emptyCheckoutAddress(draftRef.current?.couponCode);
  }, [selectedAddressMissing]);

  const selectSavedAddress = (address: CustomerAddress) => {
    addressChoiceTouchedRef.current = true;
    setAddressChoice(address.id);
    draftRef.current = savedAddressToCheckout(address, draftRef.current?.couponCode);
  };

  const useDifferentAddress = () => {
    addressChoiceTouchedRef.current = true;
    setAddressChoice('manual');
    draftRef.current = emptyCheckoutAddress(draftRef.current?.couponCode);
  };

  const commitManualChoice = () => {
    addressChoiceTouchedRef.current = true;
    if (addressChoice !== 'manual') setAddressChoice('manual');
  };

  // An address can be edited during a profile refetch without changing its id.
  // Include all shipping fields in the key so the read-only snapshot remounts
  // with the new values instead of retaining stale local form state.
  const addressFormKey = selectedSavedAddress
    ? JSON.stringify([
        selectedSavedAddress.id,
        selectedSavedAddress.fullName,
        selectedSavedAddress.phone,
        selectedSavedAddress.line1,
        selectedSavedAddress.line2,
        selectedSavedAddress.city,
        selectedSavedAddress.state,
        selectedSavedAddress.pincode,
        selectedSavedAddress.country,
      ])
    : selectedAddressMissing
      ? `removed-${addressChoice}`
      : 'manual';

  const serverCart = cartQuery.data;
  const deltas = serverCart ? computeCartDeltas(clientLines, serverCart.lines) : [];
  const canContinueReview = deltas.length === 0 || acked;

  async function placeOrder(dto: CheckoutAddress) {
    lastDtoRef.current = dto;
    setPhase({ name: 'placing' });
    try {
      const key = await checkoutIdempotencyKey(getAttemptId(), dto);
      const order = await api.orders.create(dto, key);
      setPhase({ name: 'confirm', order });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const message = err instanceof ApiError ? err.message : 'Something went wrong placing your order.';
      const action = classifyOrderError(status, message, Boolean(dto.couponCode));
      if (action.kind === 'empty-cart') {
        router.push('/cart');
        return;
      }
      setPhase({ name: 'recovery', action });
    }
  }

  async function pay(order: Order) {
    setPhase({ name: 'paying', order });
    paymentFailureRef.current = null;
    try {
      const init = await api.razorpay.initiate(order.number);
      await openRazorpayCheckout({
        keyId: init.keyId,
        razorpayOrderId: init.razorpayOrderId,
        amountMinor: init.amountMinor,
        currency: init.currency,
        orderNumber: init.orderNumber,
        prefill: { name: order.shippingFullName, contact: order.shippingPhone },
        onSuccess: async (resp) => {
          try {
            await api.razorpay.verify({
              orderNumber: order.number,
              razorpayOrderId: resp.razorpay_order_id,
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpaySignature: resp.razorpay_signature,
            });
          } catch {
            // The webhook is the ground truth; the result page polls it.
          }
          try {
            sessionStorage.removeItem('wh-checkout-attempt'); // attempt done — next checkout is fresh
          } catch {
            /* ignore */
          }
          useCartStore.getState().clear();
          router.push(`/orders/${order.number}`);
        },
        onFailure: (response) => {
          const message = razorpayFailureMessage(response);
          paymentFailureRef.current = message;
          setPhase({ name: 'confirm', order, notice: { kind: 'failed', message } });
        },
        onDismiss: () => {
          const failure = paymentFailureRef.current;
          setPhase({
            name: 'confirm',
            order,
            notice: failure
              ? { kind: 'failed', message: failure }
              : {
                  kind: 'cancelled',
                  message: 'Payment window closed. Your order is saved, and you can try again when you’re ready.',
                },
          });
        },
      });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      // Already paid (webhook settled before the client re-initiated) — this is
      // success, not an error: route to the result page.
      if (status === 409) {
        router.push(`/orders/${order.number}`);
        return;
      }
      const message =
        status === 503
          ? 'Online payments aren’t available right now. Please try again shortly.'
          : err instanceof ApiError
            ? err.message
            : 'We couldn’t start the payment. Please try again.';
      setPhase({ name: 'error', message });
    }
  }

  // ---- shells ----
  if (cartQuery.isPending) {
    return (
      <section className="container-wide py-20 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-600" />
        <p className="mt-4 text-ink-muted">Loading your order…</p>
      </section>
    );
  }
  if (cartQuery.isError) {
    return (
      <section className="container-wide py-20 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-brand-500" />
        <h1 className="mt-4 text-display-md">We couldn’t load your cart</h1>
        <p className="mt-2 text-ink-muted">Please try again in a moment.</p>
        <button onClick={() => cartQuery.refetch()} className="mt-6 rounded-full bg-navy-900 text-cream px-6 py-3 text-sm font-medium">
          Retry
        </button>
      </section>
    );
  }
  if (!serverCart || serverCart.lines.length === 0) {
    return (
      <section className="container-wide py-20 text-center">
        <ShoppingBag className="mx-auto h-12 w-12 text-brand-600" />
        <h1 className="mt-6 text-display-md">Your cart is empty</h1>
        <p className="mt-3 text-ink-muted">Add something before checking out.</p>
        <Link href="/shop" className="mt-6 inline-flex items-center gap-2 rounded-full bg-navy-900 text-cream px-6 py-3 text-sm font-medium hover:bg-navy-800">
          Shop now <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    );
  }

  return (
    <section className="container-wide py-10 sm:py-14">
      <h1 className="text-display-md">Checkout</h1>

      <div className="mt-8 grid lg:grid-cols-[1fr_360px] gap-8">
        <div>
          {/* STEP 1 — reconciled review */}
          {phase.name === 'review' && (
            <div className="space-y-4">
              <h2 className="font-display text-xl text-navy-900">Review your order</h2>
              {deltas.length > 0 && (
                <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4">
                  <p className="text-sm font-bold text-navy-900">Some items changed since you added them:</p>
                  <ul className="mt-2 list-disc pl-5 text-sm text-navy-900/80 space-y-1">
                    {deltas.map((d) => (
                      <li key={d.productId + d.kind}>{d.detail}</li>
                    ))}
                  </ul>
                  <label className="mt-3 flex items-center gap-2 text-sm font-medium text-navy-900">
                    <input type="checkbox" checked={acked} onChange={(e) => setAcked(e.target.checked)} />
                    I’ve reviewed the changes
                  </label>
                </div>
              )}
              <ul className="space-y-3">
                {serverCart.lines.map((l) => (
                  <li key={l.productId} className="flex gap-4 rounded-2xl bg-white p-3 border border-navy-900/5 shadow-soft">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-cream-200">
                      <Image src={l.thumbnail} alt={l.name} fill sizes="64px" className="object-cover" />
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-navy-900 line-clamp-1">{l.name}</p>
                        <p className="text-xs text-ink-muted">Qty {l.quantity} · {inr(l.unitPrice.amount)} each</p>
                      </div>
                      <p className="font-semibold text-navy-900 shrink-0">{inr(l.lineTotal.amount)}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setPhase({ name: 'address' })}
                disabled={!canContinueReview}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-navy-900 text-cream h-12 px-6 text-sm font-bold hover:bg-navy-800 disabled:opacity-50"
              >
                Continue to shipping <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* STEP 2 — address */}
          {phase.name === 'address' && (
            <div className="space-y-4">
              <h2 className="font-display text-xl text-navy-900">Shipping address</h2>
              <SavedAddressSelector
                status={savedAddressStatus}
                addresses={savedAddresses}
                selected={selectedAddressChoice}
                onSelect={selectSavedAddress}
                onUseDifferent={useDifferentAddress}
                onManualIntent={commitManualChoice}
                onRetry={() => profileQuery.refetch()}
              />
              <AddressForm
                key={addressFormKey}
                defaults={
                  selectedSavedAddress
                    ? savedAddressToCheckout(selectedSavedAddress, draftRef.current?.couponCode)
                    : selectedAddressMissing
                      ? emptyCheckoutAddress(draftRef.current?.couponCode)
                      : draftRef.current ?? emptyCheckoutAddress()
                }
                addressFieldsDisabled={Boolean(selectedSavedAddress)}
                onEdit={(field) => {
                  // Coupon entry is independent of the address choice and must
                  // not opt the customer out of an incoming default address.
                  if (field === 'couponCode') return;
                  commitManualChoice();
                }}
                onChange={(dto) => {
                  draftRef.current = dto;
                }}
                submitLabel="Place order"
                onSubmit={placeOrder}
              />
              <button onClick={() => setPhase({ name: 'review' })} className="text-sm text-ink-muted hover:text-navy-900">
                ← Back to review
              </button>
            </div>
          )}

          {phase.name === 'placing' && (
            <div className="rounded-3xl bg-white border border-navy-900/5 p-10 text-center shadow-soft">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-600" />
              <p className="mt-4 text-ink-muted">Placing your order…</p>
            </div>
          )}

          {/* Error-reason-driven recovery — a 4xx here NEVER opens checkout.js */}
          {phase.name === 'recovery' && (
            <div className="rounded-3xl bg-white border border-brand-500/30 p-8 shadow-soft">
              <AlertTriangle className="h-8 w-8 text-brand-500" />
              <h2 className="mt-3 font-display text-xl text-navy-900">We need to adjust your order</h2>
              <p className="mt-2 text-navy-900/80">{phase.action.message}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                {(phase.action.kind === 'reduce-quantity' || phase.action.kind === 'remove-line') && (
                  <Link href="/cart" className="rounded-full bg-navy-900 text-cream px-5 py-2.5 text-sm font-bold hover:bg-navy-800">
                    Review my cart
                  </Link>
                )}
                {phase.action.kind === 'strip-coupon' && lastDtoRef.current && (
                  <button
                    onClick={() => placeOrder({ ...lastDtoRef.current!, couponCode: undefined })}
                    className="rounded-full bg-navy-900 text-cream px-5 py-2.5 text-sm font-bold hover:bg-navy-800"
                  >
                    Place order without the coupon
                  </button>
                )}
                {(phase.action.kind === 'retry' || phase.action.kind === 'unknown') && lastDtoRef.current && (
                  <button
                    onClick={() => placeOrder(lastDtoRef.current!)}
                    className="rounded-full bg-navy-900 text-cream px-5 py-2.5 text-sm font-bold hover:bg-navy-800"
                  >
                    Try again
                  </button>
                )}
                <button onClick={() => setPhase({ name: 'address' })} className="rounded-full border border-navy-900/15 px-5 py-2.5 text-sm font-medium text-navy-900 hover:bg-navy-900/5">
                  Edit address
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — authoritative total confirm, then pay */}
          {(phase.name === 'confirm' || phase.name === 'paying') && (
            <div className="rounded-3xl bg-white border border-navy-900/5 p-8 shadow-soft">
              <h2 className="font-display text-xl text-navy-900">Confirm & pay</h2>
              <p className="mt-1 text-sm text-ink-muted">Order {phase.order.number}</p>
              {phase.name === 'confirm' && phase.notice && (
                <div
                  role={phase.notice.kind === 'failed' ? 'alert' : 'status'}
                  aria-live="polite"
                  className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
                    phase.notice.kind === 'failed'
                      ? 'border-blush/30 bg-blush/5 text-blush-600'
                      : 'border-brand-500/25 bg-brand-500/5 text-navy-900'
                  }`}
                >
                  <AlertTriangle className="mr-2 inline h-4 w-4" aria-hidden="true" />
                  {phase.notice.message}
                </div>
              )}
              <dl className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-ink-muted">Items</dt><dd>{inr(phase.order.subtotalMinor)}</dd></div>
                {phase.order.discountMinor > 0 && (
                  <div className="flex justify-between text-brand-700"><dt>Discount{phase.order.appliedCouponCode ? ` (${phase.order.appliedCouponCode})` : ''}</dt><dd>−{inr(phase.order.discountMinor)}</dd></div>
                )}
                <div className="flex justify-between"><dt className="text-ink-muted">Shipping</dt><dd>{phase.order.shippingMinor === 0 ? 'Free' : inr(phase.order.shippingMinor)}</dd></div>
                <div className="border-t border-navy-900/10 pt-2 flex justify-between text-base font-semibold text-navy-900">
                  <dt>Total to pay</dt><dd>{inr(phase.order.totalMinor)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-ink-muted">This is the final amount — confirmed from live prices. Inclusive of all taxes.</p>
              <button
                onClick={() => pay(phase.order)}
                disabled={phase.name === 'paying'}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 text-white h-12 px-6 text-sm font-bold hover:bg-brand-600 disabled:opacity-60"
              >
                {phase.name === 'paying' ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening payment…</> : <>Pay {inr(phase.order.totalMinor)} securely</>}
              </button>
            </div>
          )}

          {phase.name === 'error' && (
            <div className="rounded-3xl bg-white border border-blush/30 p-8 shadow-soft">
              <AlertTriangle className="h-8 w-8 text-blush-600" />
              <h2 className="mt-3 font-display text-xl text-navy-900">Payment couldn’t start</h2>
              <p className="mt-2 text-navy-900/80">{phase.message}</p>
              <button onClick={() => setPhase({ name: 'review' })} className="mt-5 rounded-full bg-navy-900 text-cream px-5 py-2.5 text-sm font-bold hover:bg-navy-800">
                Back to review
              </button>
            </div>
          )}
        </div>

        {/* Order summary sidebar — ESTIMATE until an order is created */}
        <aside className="rounded-3xl bg-white border border-navy-900/5 p-6 shadow-soft h-fit lg:sticky lg:top-24">
          <h2 className="font-display text-xl text-navy-900">Summary</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Subtotal</dt>
              <dd className="font-medium">{inr(serverCart.subtotal.amount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Shipping</dt>
              <dd className="font-medium">{serverCart.shipping.amount === 0 ? <span className="text-brand-700">Free</span> : inr(serverCart.shipping.amount)}</dd>
            </div>
            <div className="border-t border-navy-900/10 pt-3 flex justify-between text-base">
              <dt className="font-medium text-navy-900">Estimated total</dt>
              <dd className="font-semibold text-navy-900">{inr(serverCart.total.amount)}</dd>
            </div>
          </dl>
          <p className="mt-3 rounded-2xl bg-cream-200 px-4 py-3 text-xs text-navy-900">
            <ShieldCheck className="inline h-3.5 w-3.5 mr-1 text-brand-600" />
            Estimated total — the final amount (with any coupon) is confirmed before you pay, and shown in the Razorpay window.
          </p>
        </aside>
      </div>
    </section>
  );
}
