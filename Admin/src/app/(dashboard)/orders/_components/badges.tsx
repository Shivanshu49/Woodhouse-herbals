import { cn } from '@/lib/cn';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  paymentBadge,
  type BadgeTone,
} from '@/lib/order-badges';
import type { AdminOrderRow, OrderStatus } from '@/types/order';

const pill = 'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium';
const dot = 'h-1.5 w-1.5 rounded-full bg-current';

const TONE_STYLES: Record<BadgeTone, string> = {
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
  warning:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400',
  danger:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400',
  info: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-400',
  indigo:
    'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-400',
  violet:
    'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-400',
  neutral:
    'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-500/30 dark:bg-zinc-500/10 dark:text-zinc-400',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn(pill, TONE_STYLES[ORDER_STATUS_TONE[status]])}>
      <span className={dot} aria-hidden />
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}

export function PaymentBadge({
  row,
}: {
  row: Pick<AdminOrderRow, 'paymentMethod' | 'paymentStatus'>;
}) {
  const b = paymentBadge(row);
  return <span className={cn(pill, TONE_STYLES[b.tone])}>{b.label}</span>;
}

export function GuestBadge() {
  return <span className={cn(pill, TONE_STYLES.neutral)}>Guest</span>;
}
