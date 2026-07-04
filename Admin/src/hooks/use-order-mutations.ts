import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import type { AddOrderNoteBody, CancelOrderBody } from '@/types/order';

function toMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Something went wrong';
}

export function useAddOrderNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddOrderNoteBody) => api.orders.addNote(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.orders.detail(id) });
      toast.success('Note added');
    },
    onError: (err) => toast.error(toMessage(err)),
  });
}

export function useCancelOrder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CancelOrderBody) => api.orders.cancel(id, body),
    onSuccess: () => toast.success('Order cancelled — items restocked'),
    // A 409 (state changed underneath) surfaces the backend's message verbatim.
    onError: (err) => toast.error(toMessage(err)),
    // Refetch either way so the row reflects the true status after a lost race.
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.orders.all });
      void qc.invalidateQueries({ queryKey: qk.orders.detail(id) });
    },
  });
}
