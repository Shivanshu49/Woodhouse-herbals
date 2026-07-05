import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { StoreProfilePatch, UpdateStaffBody } from '@/types/settings';

const KEYS = {
  store: ['settings', 'store'] as const,
  integrations: ['settings', 'integrations'] as const,
  users: ['admin-users'] as const,
};

function toMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Something went wrong';
}

export function useStoreProfile() {
  return useQuery({ queryKey: KEYS.store, queryFn: () => api.settings.getStore() });
}

export function useUpdateStoreProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StoreProfilePatch) => api.settings.updateStore(body),
    onSuccess: (profile) => {
      qc.setQueryData(KEYS.store, profile);
      toast.success('Store profile saved');
    },
    onError: (err) => toast.error(toMessage(err)),
  });
}

export function useIntegrations() {
  return useQuery({ queryKey: KEYS.integrations, queryFn: () => api.settings.integrations() });
}

export function useStaffUsers() {
  return useQuery({ queryKey: KEYS.users, queryFn: () => api.users.list() });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.users.create,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.users });
      toast.success('Staff member invited');
    },
    onError: (err) => toast.error(toMessage(err)),
  });
}

export function useUpdateStaff(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateStaffBody) => api.users.update(id, body),
    onSuccess: () => toast.success('Staff member updated'),
    onError: (err) => toast.error(toMessage(err)),
    onSettled: () => void qc.invalidateQueries({ queryKey: KEYS.users }),
  });
}
