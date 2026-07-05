'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { AdjustStockBody } from '@/types/product';

export function useInventory(params: { q?: string; lowStockOnly?: boolean; page?: number }) {
  return useQuery({
    queryKey: ['inventory', params],
    queryFn: () => api.inventory.overview(params),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

export function useInventoryHistory(productId: string | null) {
  return useQuery({
    queryKey: ['inventory-history', productId],
    queryFn: () => api.inventory.history(productId as string),
    enabled: !!productId,
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdjustStockBody) => api.inventory.adjust(body),
    onSuccess: (r) => toast.success(`Stock adjusted — now ${r.newQty}`),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Adjustment failed'),
    onSettled: (_r, _e, body) => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
      void qc.invalidateQueries({ queryKey: ['inventory-history', body.productId] });
    },
  });
}
