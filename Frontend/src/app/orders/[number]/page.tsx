'use client';

// Reads the live order (guest-ownable via wh_sid) and polls; never static.
export const dynamic = 'force-dynamic';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { Order, OrderStatus } from '@/types/order';

const inr = (minor: number) =>
  `₹${(minor / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// Anything past PENDING that isn't a failure counts as a paid/confirmed order.
const PAID_STATES: OrderStatus[] = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
const FAILED_STATES: OrderStatus[] = ['CANCELLED', 'REFUNDED'];

export default function OrderResultPage() {
  const params = useParams<{ number: string }>();
  const number = String(params.number);

  const query = useQuery<Order, ApiError>({
    queryKey: ['order', number],
    queryFn: () => api.orders.get(number),
    retry: false,
    // Poll while PENDING (the webhook / verify settles it); stop once resolved.
    refetchInterval: (q) => (q.state.data && q.state.data.status !== 'PENDING' ? false : 2500),
  });

  if (query.isPending) {
    return (
      <Shell>
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-600" />
        <p className="mt-4 text-ink-muted">Loading your order…</p>
      </Shell>
    );
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <Shell>
        <AlertTriangle className="mx-auto h-10 w-10 text-brand-500" />
        <h1 className="mt-4 text-display-md">{notFound ? 'Order not found' : 'Couldn’t load your order'}</h1>
        <p className="mt-2 text-ink-muted">
          {notFound
            ? 'This order isn’t linked to your session. If you just paid, please check your email for confirmation.'
            : 'Please refresh in a moment.'}
        </p>
        <Link href="/shop" className="mt-6 inline-flex items-center gap-2 rounded-full bg-navy-900 text-cream px-6 py-3 text-sm font-medium">
          Continue shopping <ArrowRight className="h-4 w-4" />
        </Link>
      </Shell>
    );
  }

  const order = query.data;
  const paid = PAID_STATES.includes(order.status);
  const failed = FAILED_STATES.includes(order.status);
  const pending = order.status === 'PENDING';

  if (pending) {
    return (
      <Shell>
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-600" />
        <h1 className="mt-4 text-display-md">Confirming your payment…</h1>
        <p className="mt-2 text-ink-muted">Order {order.number}. This usually takes a few seconds — you can stay on this page.</p>
      </Shell>
    );
  }

  if (failed) {
    return (
      <Shell>
        <AlertTriangle className="mx-auto h-10 w-10 text-blush-600" />
        <h1 className="mt-4 text-display-md">Payment not completed</h1>
        <p className="mt-2 text-ink-muted">Order {order.number} was {order.status.toLowerCase()}. No payment was captured.</p>
        <Link href="/cart" className="mt-6 inline-flex items-center gap-2 rounded-full bg-navy-900 text-cream px-6 py-3 text-sm font-medium">
          Back to cart <ArrowRight className="h-4 w-4" />
        </Link>
      </Shell>
    );
  }

  // Paid / confirmed.
  return (
    <section className="container-wide py-12 sm:py-16 max-w-2xl mx-auto">
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-brand-600" />
        <h1 className="mt-4 text-display-md">Order confirmed{paid ? '!' : ''}</h1>
        <p className="mt-2 text-ink-muted">Thank you — order <span className="font-semibold text-navy-900">{order.number}</span> is {order.status.toLowerCase()}.</p>
      </div>

      <div className="mt-8 rounded-3xl bg-white border border-navy-900/5 p-6 shadow-soft">
        <ul className="space-y-3">
          {order.items.map((it) => (
            <li key={it.id} className="flex gap-4">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-cream-200">
                <Image src={it.productImageSnapshot} alt={it.productNameSnapshot} fill sizes="56px" className="object-cover" />
              </div>
              <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-navy-900 line-clamp-1">{it.productNameSnapshot}</p>
                  <p className="text-xs text-ink-muted">Qty {it.quantity} · {inr(it.unitPriceMinor)} each</p>
                </div>
                <p className="font-semibold text-navy-900 shrink-0">{inr(it.lineTotalMinor)}</p>
              </div>
            </li>
          ))}
        </ul>
        <dl className="mt-5 space-y-2 border-t border-navy-900/10 pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd>{inr(order.subtotalMinor)}</dd></div>
          {order.discountMinor > 0 && (
            <div className="flex justify-between text-brand-700"><dt>Discount{order.appliedCouponCode ? ` (${order.appliedCouponCode})` : ''}</dt><dd>−{inr(order.discountMinor)}</dd></div>
          )}
          <div className="flex justify-between"><dt className="text-ink-muted">Shipping</dt><dd>{order.shippingMinor === 0 ? 'Free' : inr(order.shippingMinor)}</dd></div>
          <div className="border-t border-navy-900/10 pt-2 flex justify-between text-base font-semibold text-navy-900">
            <dt>Total paid</dt><dd>{inr(order.totalMinor)}</dd>
          </div>
        </dl>
        <div className="mt-5 text-sm text-ink-muted">
          <p className="font-medium text-navy-900">Shipping to</p>
          <p className="mt-1">{order.shippingFullName} · {order.shippingPhone}</p>
          <p>{order.shippingLine1}{order.shippingLine2 ? `, ${order.shippingLine2}` : ''}</p>
          <p>{order.shippingCity}, {order.shippingState} {order.shippingPincode}</p>
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-3">
        <Link href="/shop" className="inline-flex items-center gap-2 rounded-full bg-navy-900 text-cream px-6 py-3 text-sm font-medium hover:bg-navy-800">
          Continue shopping <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <section className="container-wide py-20 text-center max-w-lg mx-auto">{children}</section>;
}
