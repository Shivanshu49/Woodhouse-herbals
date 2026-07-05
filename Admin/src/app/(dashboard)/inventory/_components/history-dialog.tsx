'use client';

import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useInventoryHistory } from '@/hooks/use-inventory';
import { RelativeDate } from '../../orders/_components/relative-date';
import type { InventoryRow } from '@/types/inventory';

export function HistoryDialog({
  row,
  onOpenChange,
}: {
  row: InventoryRow | null;
  onOpenChange: (o: boolean) => void;
}) {
  const { data, isLoading } = useInventoryHistory(row?.id ?? null);

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Movement history</DialogTitle>
          <DialogDescription>{row?.name} · every stock change, most recent first</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !data || data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No movements recorded.</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 font-medium">Reason</th>
                  <th className="py-2 font-medium">Change</th>
                  <th className="py-2 font-medium">Balance</th>
                  <th className="py-2 font-medium">By</th>
                  <th className="py-2 font-medium">Order</th>
                  <th className="py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {data.map((m) => (
                  <tr key={m.id} className="border-b">
                    <td className="py-2">
                      <span className="rounded-full border bg-muted px-2 py-0.5 text-xs">
                        {m.reason.replace(/_/g, ' ')}
                      </span>
                      {m.note && <div className="mt-0.5 text-xs text-muted-foreground">{m.note}</div>}
                    </td>
                    <td className={`py-2 font-medium ${m.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {m.delta >= 0 ? '+' : '−'}
                      {Math.abs(m.delta)}
                    </td>
                    <td className="py-2 text-muted-foreground">{m.previousQty} → {m.newQty}</td>
                    <td className="py-2">{m.actorName ?? <span className="text-muted-foreground">system</span>}</td>
                    <td className="py-2">
                      {m.order ? (
                        <Link href={`/orders/${m.order.id}`} className="text-sky-600 hover:underline">
                          {m.order.number}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2">
                      <RelativeDate iso={m.createdAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
