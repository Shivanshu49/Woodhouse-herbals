'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, toMessage } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import type { CreateCouponBody, UpdateCouponBody } from '@/types/coupon';

export function useCoupons() {
  return useQuery({ queryKey: qk.coupons.all, queryFn: api.coupons.list });
}

export function useCoupon(id: string | null) {
  return useQuery({
    queryKey: id ? qk.coupons.detail(id) : ['coupons', 'detail', 'none'],
    queryFn: () => api.coupons.get(id as string),
    enabled: !!id,
  });
}

export function useCreateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCouponBody) => api.coupons.create(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.coupons.all });
      toast.success('Coupon created');
    },
    onError: (e) => toast.error(toMessage(e)),
  });
}

export function useUpdateCoupon(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateCouponBody) => api.coupons.update(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.coupons.all });
      void qc.invalidateQueries({ queryKey: qk.coupons.detail(id) });
      toast.success('Coupon updated');
    },
    onError: (e) => toast.error(toMessage(e)),
  });
}

export function useSetCouponActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.coupons.setActive(id, active),
    onSuccess: (_res, { id }) => {
      void qc.invalidateQueries({ queryKey: qk.coupons.all });
      void qc.invalidateQueries({ queryKey: qk.coupons.detail(id) });
    },
    onError: (e) => toast.error(toMessage(e)),
  });
}
