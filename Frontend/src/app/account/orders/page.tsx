'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { Package } from 'lucide-react';
import { api } from '@/lib/api';
import { AccountShell } from '@/components/account/AccountShell';
import { Button } from '@/components/ui/Button';
import type { CustomerOrder } from '@/types/auth';

const formatInr = (minor: number) =>
  `₹${(minor / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-cream text-ink-muted',
  CONFIRMED: 'bg-sage-100 text-brand-800',
  PAID: 'bg-sage-100 text-brand-800',
  SHIPPED: 'bg-navy-100 text-navy-800',
  DELIVERED: 'bg-sage-200 text-brand-900',
  CANCELLED: 'bg-blush-100 text-blush-600',
  REFUNDED: 'bg-blush-100 text-blush-600',
};

function OrdersList() {
  const { data, isPending, isError } = useQuery<CustomerOrder[]>({
    queryKey: ['customer', 'orders'],
    queryFn: () => api.customer.orders(),
    retry: false,
  });

  if (isPending) return <div className="h-40 rounded-3xl bg-navy-900/5 animate-pulse" />;
  if (isError || !data) {
    return <p className="font-inter text-sm text-ink-muted">Could not load orders right now — try again in a bit.</p>;
  }
  if (data.length === 0) {
    return (
      <div className="rounded-3xl bg-white border border-navy-900/8 p-10 text-center">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-cream text-ink-muted">
          <Package className="h-7 w-7" />
        </span>
        <p className="mt-4 font-inter text-[15px] text-ink-muted">No orders yet — your rituals await.</p>
        <Link href="/shop">
          <Button className="mt-6">Browse the shop</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((order) => (
        <div key={order.id} className="rounded-3xl bg-white border border-navy-900/8 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-inter font-semibold text-navy-900">#{order.number}</p>
              <p className="font-inter text-xs text-ink-subtle">
                {new Date(order.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 font-inter text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[order.status] ?? 'bg-cream text-ink-muted'}`}
              >
                {order.status.toLowerCase()}
              </span>
              <span className="font-display font-bold text-lg text-brand-forest">{formatInr(order.totalMinor)}</span>
            </div>
          </div>
          <ul className="mt-4 space-y-2 border-t border-navy-900/8 pt-4">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 font-inter text-sm text-ink-muted">
                {item.productImageSnapshot ? (
                  <Image
                    src={item.productImageSnapshot}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-xl object-cover bg-cream"
                    unoptimized
                  />
                ) : null}
                <span className="flex-1 truncate text-navy-900">{item.productNameSnapshot}</span>
                <span>× {item.quantity}</span>
                <span className="font-semibold text-navy-900">{formatInr(item.lineTotalMinor)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function OrdersPage() {
  return <AccountShell title="orders.">{() => <OrdersList />}</AccountShell>;
}
