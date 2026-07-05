'use client';

import { formatInr } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { useRecheckRefund } from '@/hooks/use-order-mutations';
import type { OrderDetail, RefundStatus } from '@/types/order';
import { RefundActionButton } from './refund-action-button';

const STATUS_STYLE: Record<RefundStatus, string> = {
  PROCESSED: 'text-emerald-600 dark:text-emerald-400',
  PENDING: 'text-amber-600 dark:text-amber-400',
  FAILED: 'text-red-600 dark:text-red-400',
};

export function RefundsPanel({
  order,
  role,
  onRefund,
}: {
  order: OrderDetail;
  role: string | undefined;
  onRefund: () => void;
}) {
  const recheck = useRecheckRefund(order.id);
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h3 className="text-sm font-medium">Refunds</h3>
      {order.refunds.length === 0 && <p className="text-sm text-muted-foreground">No refunds.</p>}
      {order.refunds.map((r) => (
        <div key={r.id} className="space-y-1 rounded-md border p-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {r.method} · {formatInr(r.amountMinor)}
            </span>
            <span className={STATUS_STYLE[r.status]}>{r.status}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {r.disposition}
            {r.utrReference ? ` · UTR ${r.utrReference}` : ''}
            {r.providerRefundId ? ` · ${r.providerRefundId}` : ''}
          </div>
          {r.status === 'PENDING' && r.method === 'PHONEPE' && (
            <Button size="sm" variant="outline" onClick={() => recheck.mutate()} disabled={recheck.isPending}>
              {recheck.isPending ? 'Re-checking…' : 'Re-check status'}
            </Button>
          )}
          {r.status === 'FAILED' && (
            <div className="text-xs text-red-600 dark:text-red-400">
              Failed{r.reason ? `: ${r.reason}` : ''} — retry below.
            </div>
          )}
        </div>
      ))}
      <RefundActionButton order={order} role={role} onRefund={onRefund} size="sm" />
    </div>
  );
}
