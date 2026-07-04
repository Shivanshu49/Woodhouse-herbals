'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Package, Plus, SearchX } from 'lucide-react';
import type { RowSelectionState } from '@tanstack/react-table';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useProducts } from '@/hooks/use-products';
import { useProductsView } from './_components/use-products-view';
import { ProductsToolbar } from './_components/products-toolbar';
import { ProductsTable } from './_components/products-table';
import { ProductsPagination } from './_components/products-pagination';
import { BulkActionBar } from './_components/bulk-action-bar';

export default function ProductsPage() {
  const { view, apiParams, filterCount, setSearch, setSort, setFilter, setPage, setPerPage, clearFilters } =
    useProductsView();
  const { data, isPending, isError, isFetching, refetch } = useProducts(apiParams);

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  // The selection is page/filter-scoped: reset it whenever the view changes so
  // a bulk action never targets rows that scrolled out of view.
  useEffect(() => {
    setRowSelection({});
  }, [apiParams]);

  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection],
  );

  const addButton = (
    <Button asChild>
      <Link href="/products/new">
        <Plus className="h-4 w-4" />
        Add product
      </Link>
    </Button>
  );

  const total = data?.total ?? 0;
  const isEmpty = !isPending && !isError && total === 0;
  const isFiltered = filterCount > 0 || view.q.trim() !== '';

  // If the result set shrinks (e.g. bulk archive / delete on the last page) so
  // the current page no longer exists, snap back to the last valid page rather
  // than showing an empty body with a nonsensical "26–25 of 25" footer.
  const pageCount = Math.max(1, Math.ceil(total / (data?.perPage ?? view.perPage)));
  useEffect(() => {
    if (total > 0 && view.page > pageCount) setPage(pageCount);
  }, [total, view.page, pageCount, setPage]);

  return (
    <div>
      <PageHeader
        title="Products"
        description="Your catalog — herbal skincare, combos, and everything you sell."
        action={addButton}
      />

      <ProductsToolbar
        view={view}
        filterCount={filterCount}
        setSearch={setSearch}
        setSort={setSort}
        setFilter={setFilter}
        clearFilters={clearFilters}
      />

      {isError && !data ? (
        <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-lg border border-dashed bg-card/40 px-6 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold">Couldn’t load products</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Something went wrong talking to the server. Check your connection and try again.
          </p>
          <Button variant="outline" className="mt-5" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : isEmpty ? (
        isFiltered ? (
          <EmptyState
            icon={SearchX}
            title="No products match your filters"
            description="Try adjusting or clearing the search and filters to see more of your catalog."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Package}
            title="No products yet"
            description="Add your first product to start building the catalog."
            action={addButton}
          />
        )
      ) : (
        <>
          <div
            className={cn(
              'transition-opacity',
              isFetching && !isPending && 'pointer-events-none opacity-60',
            )}
          >
            <ProductsTable
              data={data?.items ?? []}
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
              loading={isPending}
            />
          </div>
          <ProductsPagination
            page={data?.page ?? view.page}
            perPage={data?.perPage ?? view.perPage}
            total={total}
            onPage={setPage}
            onPerPage={setPerPage}
          />
        </>
      )}

      {selectedIds.length > 0 ? (
        <BulkActionBar
          ids={selectedIds}
          archivedView={view.status === 'ARCHIVED'}
          onClear={() => setRowSelection({})}
        />
      ) : null}
    </div>
  );
}
