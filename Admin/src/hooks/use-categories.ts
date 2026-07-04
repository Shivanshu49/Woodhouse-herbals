import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';

/**
 * Free-form categories (Category table) used to populate the "Set category"
 * bulk-action picker. Fetched lazily — pass `enabled` false until the picker
 * is actually opened.
 */
export function useCategories(enabled = true) {
  return useQuery({
    queryKey: qk.categories,
    queryFn: () => api.categories.list(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
