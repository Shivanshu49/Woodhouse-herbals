'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CustomerProfile } from '@/types/auth';

export const PROFILE_KEY = ['customer', 'profile'] as const;

/**
 * The signed-in customer's profile, or null when logged out / backend
 * unreachable. Every auth surface (header, account pages, login redirects)
 * reads this single query so login/logout invalidations propagate everywhere.
 */
export function useProfile() {
  return useQuery<CustomerProfile | null>({
    queryKey: PROFILE_KEY,
    queryFn: async () => {
      try {
        return await api.customer.profile();
      } catch {
        // 401 = logged out; network failure = treat as logged out so the
        // storefront keeps working when the API is down.
        return null;
      }
    },
    staleTime: 30_000,
    retry: false,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await api.auth.logout();
      } catch {
        // Cookie may already be expired — treat as logged out either way.
      }
    },
    onSettled: () => {
      queryClient.setQueryData(PROFILE_KEY, null);
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });
}

/**
 * Call (and await) after any successful login/signup so the whole UI flips
 * to signed-in. Awaiting matters: the profile query may be cached as `null`
 * from before login, and navigating to a guarded page before the refetch
 * lands would bounce straight back to /login.
 */
export function useRefreshProfile() {
  const queryClient = useQueryClient();
  return () => queryClient.refetchQueries({ queryKey: PROFILE_KEY });
}
