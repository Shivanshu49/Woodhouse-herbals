'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Sparkles } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { formatPrice } from '@/lib/format';

export default function CartPage() {
  const lines = useCartStore((s) => s.lines);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const remove = useCartStore((s) => s.remove);
  const subtotal = useCartStore((s) => s.subtotal());
  const shippingFree = subtotal.amount >= 49900;
  const shipping = shippingFree ? 0 : 5900;
  const total = subtotal.amount + shipping;

  if (lines.length === 0) {
    return (
      <section className="container-wide py-20 text-center">
        <ShoppingBag className="mx-auto h-12 w-12 text-brand-600" />
        <h1 className="mt-6 text-display-md">Your cart is empty</h1>
        <p className="mt-3 text-ink-muted">Start your ritual with our bestselling herbal essentials.</p>
        <Link
          href="/shop"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-navy-900 text-cream px-6 py-3 text-sm font-medium hover:bg-navy-800"
        >
          Shop now <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    );
  }

  return (
    <section className="container-wide py-10 sm:py-14">
      <h1 className="text-display-md">Your bag</h1>
      <p className="mt-2 text-ink-muted">{lines.length} item{lines.length > 1 ? 's' : ''} ready for checkout.</p>

      <div className="mt-8 grid lg:grid-cols-[1fr_360px] gap-8">
        <ul className="space-y-3">
          {lines.map((l) => (
            <li
              key={l.productId}
              className="flex gap-4 rounded-3xl bg-white p-3 sm:p-4 border border-navy-900/5 shadow-soft"
            >
              <Link href={`/shop/${l.slug}`} className="relative h-24 w-24 sm:h-28 sm:w-28 shrink-0 overflow-hidden rounded-2xl bg-cream-200">
                <Image src={l.thumbnail} alt={l.name} fill sizes="112px" className="object-cover" />
              </Link>
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/shop/${l.slug}`} className="font-display text-base text-navy-900 hover:text-brand-700 line-clamp-2">
                      {l.name}
                    </Link>
                    <p className="text-sm text-ink-muted mt-1">{formatPrice(l.unitPrice)} each</p>
                  </div>
                  <p className="font-semibold text-navy-900 shrink-0">{formatPrice(l.lineTotal)}</p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="inline-flex items-center rounded-full border border-navy-900/15 bg-white">
                    <button
                      onClick={() => setQuantity(l.productId, Math.max(0, l.quantity - 1))}
                      className="h-9 w-9 grid place-items-center text-navy-900 hover:bg-navy-900/5 rounded-l-full"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm">{l.quantity}</span>
                    <button
                      onClick={() => setQuantity(l.productId, l.quantity + 1)}
                      className="h-9 w-9 grid place-items-center text-navy-900 hover:bg-navy-900/5 rounded-r-full"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => remove(l.productId)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blush hover:text-blush-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="rounded-3xl bg-white border border-navy-900/5 p-6 shadow-soft h-fit lg:sticky lg:top-24">
          <h2 className="font-display text-xl text-navy-900">Order summary</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Subtotal</dt>
              <dd className="font-medium">{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Shipping</dt>
              <dd className="font-medium">
                {shippingFree ? <span className="text-brand-700">Free</span> : formatPrice({ amount: shipping, currency: 'INR' })}
              </dd>
            </div>
            <div className="border-t border-navy-900/10 pt-3 flex justify-between text-base">
              <dt className="font-medium text-navy-900">Total</dt>
              <dd className="font-semibold text-navy-900">{formatPrice({ amount: total, currency: 'INR' })}</dd>
            </div>
          </dl>

          {!shippingFree && (
            <p className="mt-4 rounded-2xl bg-cream-200 px-4 py-3 text-xs text-navy-900">
              <Sparkles className="inline h-3.5 w-3.5 mr-1 text-brand-600" />
              Add {formatPrice({ amount: 49900 - subtotal.amount, currency: 'INR' })} more to unlock free shipping.
            </p>
          )}

          <Link
            href="/checkout"
            className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full bg-navy-900 text-cream h-12 px-6 text-sm font-medium hover:bg-navy-800"
          >
            Proceed to checkout <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-xs text-ink-muted text-center">Secure checkout · UPI, cards &amp; netbanking via Razorpay</p>
        </aside>
      </div>
    </section>
  );
}
