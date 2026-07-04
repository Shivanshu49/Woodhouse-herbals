import { cn } from '@/lib/cn';
import { stockBucketFor } from '@/lib/product-meta';
import type { AdminProductRow } from '@/types/product';

const pill = 'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium';
const dot = 'h-1.5 w-1.5 rounded-full bg-current';

type StatusKey = 'Published' | 'Draft' | 'Scheduled' | 'Archived';

const STATUS_STYLES: Record<StatusKey, string> = {
  Published:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
  Draft:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400',
  Scheduled:
    'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-400',
  Archived:
    'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-500/30 dark:bg-zinc-500/10 dark:text-zinc-400',
};

function statusLabel(row: Pick<AdminProductRow, 'status' | 'deletedAt'>): StatusKey {
  if (row.deletedAt) return 'Archived';
  if (row.status === 'PUBLISHED') return 'Published';
  if (row.status === 'SCHEDULED') return 'Scheduled';
  return 'Draft';
}

export function StatusBadge({ row }: { row: Pick<AdminProductRow, 'status' | 'deletedAt'> }) {
  const label = statusLabel(row);
  return (
    <span className={cn(pill, STATUS_STYLES[label])}>
      <span className={dot} aria-hidden />
      {label}
    </span>
  );
}

const STOCK_STYLES = {
  in: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
  low: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400',
  out: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400',
} as const;

const STOCK_LABELS = { in: 'In stock', low: 'Low', out: 'Out of stock' } as const;

export function StockBadge({ qty }: { qty: number }) {
  const bucket = stockBucketFor(qty);
  return (
    <span className={cn(pill, STOCK_STYLES[bucket])}>
      <span className={dot} aria-hidden />
      {STOCK_LABELS[bucket]}
    </span>
  );
}
