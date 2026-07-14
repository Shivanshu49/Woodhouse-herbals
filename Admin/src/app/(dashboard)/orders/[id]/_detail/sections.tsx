'use client';

import { formatInr } from '@/lib/money';
import { RelativeDate } from '../../_components/relative-date';
import type { OrderDetail } from '@/types/order';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

export function LineItems({ items }: { items: OrderDetail['items'] }) {
  return (
    <Card title="Line items">
      <ul className="divide-y">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 py-2">
            {it.productImageSnapshot ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={it.productImageSnapshot}
                alt=""
                className="h-10 w-10 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="h-10 w-10 shrink-0 rounded bg-muted" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{it.productNameSnapshot}</p>
              <p className="text-xs text-muted-foreground">{it.skuSnapshot}</p>
            </div>
            <div className="text-right text-sm">
              <div className="text-muted-foreground">
                {it.quantity} × {formatInr(it.unitPriceMinor)}
              </div>
              <div className="font-medium">{formatInr(it.lineTotalMinor)}</div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function TotalsCard({ order }: { order: OrderDetail }) {
  const row = (label: string, value: string, strong = false) => (
    <div className={`flex justify-between text-sm ${strong ? 'font-semibold' : ''}`}>
      <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
      <span>{value}</span>
    </div>
  );
  return (
    <Card title="Totals">
      {row('Subtotal', formatInr(order.subtotalMinor))}
      {order.discountMinor > 0 && row('Discount', `−${formatInr(order.discountMinor)}`)}
      {row('Shipping', formatInr(order.shippingMinor))}
      {row('Tax (incl.)', formatInr(order.taxMinor))}
      <div className="border-t pt-2">{row('Total', formatInr(order.totalMinor), true)}</div>
    </Card>
  );
}

export function CustomerCard({ order }: { order: OrderDetail }) {
  const addr = [
    order.shippingLine1,
    order.shippingLine2,
    `${order.shippingCity}, ${order.shippingState} ${order.shippingPincode}`,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <Card title="Customer & shipping">
      <div className="text-sm">
        <p className="font-medium">{order.shippingFullName}</p>
        <p className="text-muted-foreground">
          {order.user?.email ?? '—'} · {order.shippingPhone}
        </p>
        <p className="mt-2">{addr}</p>
        {order.shippingGstin && (
          <p className="mt-1 text-xs text-muted-foreground">GSTIN: {order.shippingGstin} (B2B)</p>
        )}
      </div>
    </Card>
  );
}

export function PaymentCard({ order }: { order: OrderDetail }) {
  const txn = order.payments.find((p) => p.providerTxnId)?.providerTxnId;
  return (
    <Card title="Payment">
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Method</span>
          <span className="font-medium">{order.paymentMethod}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Razorpay txn</span>
          <span className="font-mono text-xs">{txn ?? '—'}</span>
        </div>
        {order.payments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No payment records (COD).</p>
        ) : (
          order.payments.map((p) => (
            <div key={p.id} className="flex justify-between text-xs text-muted-foreground">
              <span>{formatInr(p.amountMinor)}</span>
              <span>{p.status}</span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

export function ShipmentsCard({ shipments }: { shipments: OrderDetail['shipments'] }) {
  return (
    <Card title="Shipments">
      {shipments.length === 0 && <p className="text-sm text-muted-foreground">No shipments yet.</p>}
      {shipments.map((s) => (
        <div key={s.id} className="space-y-1 rounded-md border p-2 text-sm">
          <div className="flex justify-between">
            <span className="font-medium">{s.courier}</span>
            <span className="text-muted-foreground">{s.status}</span>
          </div>
          {s.trackingNumber && <p className="font-mono text-xs">AWB {s.trackingNumber}</p>}
          {s.events.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {s.events.map((e) => (
                <li key={e.id} className="text-xs text-muted-foreground">
                  {e.status}
                  {e.description ? ` — ${e.description}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </Card>
  );
}

export function Timeline({ events }: { events: OrderDetail['events'] }) {
  return (
    <Card title="Timeline">
      <ul className="space-y-2">
        {events.map((e) => (
          <li key={e.id} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
            <div className="flex-1">
              <span className="font-medium">
                {e.type}
                {e.toStatus ? ` → ${e.toStatus}` : ''}
              </span>
              <span className="ml-2 text-muted-foreground">{e.actor?.fullName ?? 'system'}</span>
              {e.note && <span className="ml-2 text-muted-foreground">· {e.note}</span>}
            </div>
            <RelativeDate iso={e.createdAt} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
