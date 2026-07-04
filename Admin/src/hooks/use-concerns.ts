import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';

/**
 * The concern taxonomy (Concern table) — the "Shop by Concern" tags a product
 * can be linked to. Public endpoint; cached for the session.
 */
export function useConcerns(enabled = true) {
  return useQuery({
    queryKey: qk.concerns,
    queryFn: () => api.concerns.list(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
