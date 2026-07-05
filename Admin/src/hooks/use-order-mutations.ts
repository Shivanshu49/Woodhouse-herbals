import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import type { AddOrderNoteBody, CancelOrderBody, ManualRefundBody, RefundBody } from '@/types/order';

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

function invalidateOrder(qc: ReturnType<typeof useQueryClient>, id: string) {
  void qc.invalidateQueries({ queryKey: qk.orders.all });
  void qc.invalidateQueries({ queryKey: qk.orders.detail(id) });
}

export function useRefundOrder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RefundBody) => api.orders.refund(id, body),
    onSuccess: () => toast.success('PhonePe refund initiated'),
    onError: (err) => toast.error(toMessage(err)),
    onSettled: () => invalidateOrder(qc, id),
  });
}

export function useManualRefund(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ManualRefundBody) => api.orders.manualRefund(id, body),
    onSuccess: () => toast.success('Refund recorded'),
    onError: (err) => toast.error(toMessage(err)),
    onSettled: () => invalidateOrder(qc, id),
  });
}

export function useRecheckRefund(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.orders.recheckRefund(id),
    onSuccess: (r) => toast.success(`Refund re-checked — ${r.state}`),
    onError: (err) => toast.error(toMessage(err)),
    onSettled: () => invalidateOrder(qc, id),
  });
}

export function useGenerateInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.orders.generateInvoice(id),
    onSuccess: (inv) => toast.success(`Invoice ${inv.number} ready`),
    onError: (err) => toast.error(toMessage(err)),
    onSettled: () => invalidateOrder(qc, id),
  });
}
