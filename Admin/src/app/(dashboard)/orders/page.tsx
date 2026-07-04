'use client';

import { useEffect } from 'react';
import { AlertTriangle, Package, SearchX } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useOrders } from '@/hooks/use-orders';
import { useOrdersView } from './_components/use-orders-view';
import { OrdersToolbar } from './_components/orders-toolbar';
import { OrdersTable } from './_components/orders-table';
import { OrdersPagination } from './_components/orders-pagination';

export default function OrdersPage() {
  const api = useOrdersView();
  const { data, isPending, isError, isPlaceholderData, refetch } = useOrders(api.apiParams);
  const total = data?.total ?? 0;
  const isFiltered = api.filterCount > 0 || api.view.q.trim() !== '';
  const isEmpty = !isPending && !isError && total === 0;

  // Snap back if the current page shrinks past the last page (e.g. after filtering).
  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(total / api.view.perPage));
    if (total > 0 && api.view.page > pageCount) api.setPage(pageCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  return (
    <div className="space-y-4">
      <PageHeader title="Orders" description="Every order placed on the storefront." />
      <OrdersToolbar api={api} />

      {isError && !data ? (
        <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-lg border border-dashed bg-card/40 px-6 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold">Couldn&apos;t load orders</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Something went wrong fetching orders. Please try again.
          </p>
          <Button variant="outline" className="mt-5" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : isEmpty ? (
        isFiltered ? (
          <EmptyState
            icon={SearchX}
            title="No matching orders"
            description="Try adjusting your filters or search terms."
            action={
              <Button variant="outline" onClick={api.clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Package}
            title="No orders yet"
            description="Orders placed on the storefront will appear here."
          />
        )
      ) : (
        // Dim only during a param-change refetch (isPlaceholderData) — NOT on the
        // background 30s poll / window-focus refetch, which keep the same key.
        <div
          className={cn(
            'space-y-4 transition-opacity',
            isPlaceholderData && 'pointer-events-none opacity-60',
          )}
        >
          <OrdersTable data={data?.items ?? []} loading={isPending} />
          <OrdersPagination
            page={data?.page ?? api.view.page}
            perPage={data?.perPage ?? api.view.perPage}
            total={total}
            onPage={api.setPage}
            onPerPage={api.setPerPage}
          />
        </div>
      )}
    </div>
  );
}
