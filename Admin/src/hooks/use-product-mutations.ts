'use client';

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { adjustStockInView, applyBulkToView, dropIdFromView } from '@/lib/products-optimistic';
import type {
  AdjustStockBody,
  AdminProductListParams,
  AdminProductsList,
  BulkAction,
  BulkProductsBody,
} from '@/types/product';

function toMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Something went wrong';
}

/** The list params live at index 2 of the query key: ['products','list',params]. */
function paramsOf(key: QueryKey): AdminProductListParams {
  return (key[2] as AdminProductListParams | undefined) ?? {};
}

const plural = (n: number) => (n === 1 ? '' : 's');

const BULK_SUCCESS: Record<BulkAction, (n: number) => string> = {
  publish: (n) => `Published ${n} product${plural(n)}`,
  draft: (n) => `Moved ${n} product${plural(n)} to draft`,
  archive: (n) => `Archived ${n} product${plural(n)}`,
  restore: (n) => `Restored ${n} product${plural(n)}`,
  'set-category': (n) => `Updated category for ${n} product${plural(n)}`,
};

/** Create a product from the Add Product form; on success go to the list. */
export function useCreateProduct() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (body: unknown) => api.products.create(body),
    onSuccess: () => {
      // No edit page yet — land back on the list where the new product appears.
      void qc.invalidateQueries({ queryKey: qk.products.all });
      toast.success('Product created');
      router.push('/products');
    },
    onError: (err) => toast.error(toMessage(err)),
  });
}

/** Update an existing product from the edit form; on success go to the list. */
export function useUpdateProduct(id: string) {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (body: unknown) => api.products.update(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.products.all });
      void qc.invalidateQueries({ queryKey: qk.products.detail(id) });
      toast.success('Product updated');
      router.push('/products');
    },
    onError: (err) => toast.error(toMessage(err)),
  });
}

/** Bulk publish / draft / archive / restore / set-category. */
export function useBulkProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BulkProductsBody) => api.products.bulk(body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: qk.products.all });
      const prev = qc.getQueriesData<AdminProductsList>({ queryKey: qk.products.all });
      const now = new Date().toISOString();
      for (const [key, data] of prev) {
        if (data) qc.setQueryData(key, applyBulkToView(data, body, paramsOf(key), now));
      }
      return { prev };
    },
    onError: (err, _body, ctx) => {
      ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(toMessage(err));
    },
    onSuccess: (res, body) => toast.success(BULK_SUCCESS[body.action](res.updated)),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.products.all }),
  });
}

/** Row "Delete" — a soft-delete; the product moves to the Archived view. */
export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.products.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.products.all });
      const prev = qc.getQueriesData<AdminProductsList>({ queryKey: qk.products.all });
      for (const [key, data] of prev) {
        if (data) qc.setQueryData(key, dropIdFromView(data, id, false, paramsOf(key)));
      }
      return { prev };
    },
    onError: (err, _id, ctx) => {
      ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(toMessage(err));
    },
    onSuccess: () => toast.success('Product archived — restore it from the Archived filter'),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.products.all }),
  });
}

/** Restore a single soft-deleted product. */
export function useRestoreProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.products.restore(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.products.all });
      const prev = qc.getQueriesData<AdminProductsList>({ queryKey: qk.products.all });
      for (const [key, data] of prev) {
        if (data) qc.setQueryData(key, dropIdFromView(data, id, true, paramsOf(key)));
      }
      return { prev };
    },
    onError: (err, _id, ctx) => {
      ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(toMessage(err));
    },
    onSuccess: () => toast.success('Product restored'),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.products.all }),
  });
}

/** Quick stock adjust — routes through the inventory ledger endpoint. */
export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdjustStockBody) => api.inventory.adjust(body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: qk.products.all });
      const prev = qc.getQueriesData<AdminProductsList>({ queryKey: qk.products.all });
      for (const [key, data] of prev) {
        if (!data) continue;
        const current = data.items.find((r) => r.id === body.productId);
        if (!current) continue;
        qc.setQueryData(
          key,
          adjustStockInView(data, body.productId, current.stockQty + body.delta, paramsOf(key)),
        );
      }
      return { prev };
    },
    onError: (err, _body, ctx) => {
      ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(toMessage(err));
    },
    onSuccess: (res, body) => {
      // Reconcile with the server's authoritative new quantity.
      for (const [key, data] of qc.getQueriesData<AdminProductsList>({ queryKey: qk.products.all })) {
        if (data) qc.setQueryData(key, adjustStockInView(data, body.productId, res.newQty, paramsOf(key)));
      }
      toast.success(`Stock updated to ${res.newQty}`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.products.all }),
  });
}
