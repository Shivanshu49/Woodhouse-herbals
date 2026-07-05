'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useInventory } from '@/hooks/use-inventory';
import { useAdminUser } from '@/hooks/use-admin-auth';
import type { InventoryRow } from '@/types/inventory';
import { AdjustDialog } from './_components/adjust-dialog';
import { HistoryDialog } from './_components/history-dialog';

export default function InventoryPage() {
  // Reads (overview/history) allow STAFF; the adjust WRITE is ADMIN+MANAGER only,
  // so only show the Adjust control to roles that can actually use it.
  const admin = useAdminUser();
  const canAdjust = admin.data?.role === 'ADMIN' || admin.data?.role === 'MANAGER';
  // Low-stock is the default view — that's what needs attention first.
  const [lowStockOnly, setLowStockOnly] = useState(true);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [adjusting, setAdjusting] = useState<InventoryRow | null>(null);
  const [historyFor, setHistoryFor] = useState<InventoryRow | null>(null);

  // Reset to page 1 whenever the filter/search changes.
  function setFilter(fn: () => void) {
    fn();
    setPage(1);
  }

  const { data, isLoading } = useInventory({ q: q.trim() || undefined, lowStockOnly, page });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  return (
    <div>
      <PageHeader title="Inventory" description="Stock levels, adjustments, and the full movement ledger." />

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Input
          value={q}
          onChange={(e) => setFilter(() => setQ(e.target.value))}
          placeholder="Search name or SKU…"
          className="max-w-xs"
        />
        <div className="flex items-center gap-2">
          <Switch id="low-only" checked={lowStockOnly} onCheckedChange={(v) => setFilter(() => setLowStockOnly(v))} />
          <Label htmlFor="low-only" className="text-sm">Low stock only</Label>
        </div>
        {data && <span className="text-sm text-muted-foreground">{data.total} product{data.total === 1 ? '' : 's'}</span>}
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          {lowStockOnly ? 'No low-stock products — you’re all stocked up.' : 'No products found.'}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 font-medium">Product</th>
              <th className="py-2 font-medium">Stock</th>
              <th className="py-2 font-medium">Threshold</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {data.items.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2">
                  <div className="flex items-center gap-3">
                    {r.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.thumbnailUrl} alt="" className="h-9 w-9 rounded object-cover" />
                    ) : (
                      <div className="h-9 w-9 rounded bg-muted" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.sku}</div>
                    </div>
                  </div>
                </td>
                <td className="py-2">
                  <span className={r.isLow ? 'font-semibold text-red-600' : ''}>{r.stockQty}</span>
                </td>
                <td className="py-2 text-muted-foreground">{r.lowStockThreshold}</td>
                <td className="py-2">
                  {!r.trackInventory ? (
                    <span className="text-xs text-muted-foreground">untracked</span>
                  ) : r.isLow ? (
                    <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                      Low stock
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                      In stock
                    </span>
                  )}
                </td>
                <td className="py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setHistoryFor(r)}>History</Button>
                  {canAdjust && (
                    <Button size="sm" variant="outline" onClick={() => setAdjusting(r)}>Adjust</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <AdjustDialog row={adjusting} onOpenChange={(o) => !o && setAdjusting(null)} />
      <HistoryDialog row={historyFor} onOpenChange={(o) => !o && setHistoryFor(null)} />
    </div>
  );
}
