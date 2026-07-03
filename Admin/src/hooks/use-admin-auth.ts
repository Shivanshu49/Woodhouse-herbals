'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import type { AdminUser } from '@/types/api';

/**
 * The signed-in admin, or null when logged out / session expired / the
 * account is a CUSTOMER (which must never see the admin UI). Every guarded
 * surface reads this one query.
 */
export function useAdminUser() {
  return useQuery<AdminUser | null>({
    queryKey: qk.me,
    queryFn: async () => {
      try {
        const me = await api.auth.me();
        if (me.role === 'CUSTOMER') return null;
        return { id: me.id, email: me.email, role: me.role };
      } catch {
        return null;
      }
    },
    staleTime: 30_000,
    retry: false,
  });
}

export function useAdminLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string }) => api.auth.adminLogin(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.me }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await api.auth.logout();
      } catch {
        /* cookie may already be gone — treat as logged out */
      }
    },
    onSettled: () => {
      queryClient.setQueryData(qk.me, null);
      queryClient.invalidateQueries({ queryKey: qk.me });
    },
  });
}
