'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, toMessage } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import type {
  CreateCategoryBody,
  ReorderCategoriesBody,
  UpdateCategoryBody,
} from '@/types/admin-category';

const KEY = ['admin-categories'] as const;

/** Invalidate BOTH the admin category tree AND the shared public category list
 *  (qk.categories) that the coupon + product-bulk category pickers read — a new
 *  or removed category must appear in those dropdowns immediately. */
function invalidateCategories(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: KEY });
  void qc.invalidateQueries({ queryKey: qk.categories });
}
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function useAdminCategories() {
  return useQuery({ queryKey: KEY, queryFn: () => api.adminCategories.list() });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCategoryBody) => api.adminCategories.create(body),
    onSuccess: () => {
      invalidateCategories(qc);
      toast.success('Category created');
    },
    onError: (e) => toast.error(toMessage(e)),
  });
}

export function useUpdateCategory(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateCategoryBody) => api.adminCategories.update(id, body),
    onSuccess: () => {
      invalidateCategories(qc);
      toast.success('Category updated');
    },
    onError: (e) => toast.error(toMessage(e)),
  });
}

export function useReorderCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReorderCategoriesBody) => api.adminCategories.reorder(body),
    onError: (e) => toast.error(toMessage(e)),
    onSettled: () => invalidateCategories(qc),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.adminCategories.remove(id),
    onSuccess: () => {
      invalidateCategories(qc);
      toast.success('Category deleted');
    },
    // A 409 (has products/children) surfaces the backend's clear message verbatim.
    onError: (e) => toast.error(toMessage(e)),
  });
}

export type SlugStatus = 'idle' | 'checking' | 'available' | 'taken';

/** Debounced category slug-uniqueness check (mirrors the product one). */
export function useCategorySlugCheck(slug: string, excludeId?: string): { status: SlugStatus } {
  const [debounced, setDebounced] = useState(slug);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(slug), 400);
    return () => clearTimeout(t);
  }, [slug]);

  const valid = debounced.length > 0 && SLUG_RE.test(debounced);
  const q = useQuery({
    queryKey: ['category-slug-check', debounced, excludeId ?? null],
    queryFn: () => api.adminCategories.slugCheck(debounced, excludeId),
    enabled: valid,
    staleTime: 30_000,
    retry: false,
  });

  if (!valid) return { status: 'idle' };
  if (q.isFetching) return { status: 'checking' };
  if (q.data) return { status: q.data.available ? 'available' : 'taken' };
  return { status: 'idle' };
}
