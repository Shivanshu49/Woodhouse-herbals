'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import type { ReorderBody } from '@/types/content';

function toMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Something went wrong';
}

/**
 * Build the query + mutation hooks for one content resource. Every mutation
 * invalidates the resource's list key and surfaces backend errors verbatim
 * (409 slug clash, 404 stale row, 400 bad window) — the admin never masks them.
 */
function makeResource<TRow, TBody>(
  key: readonly unknown[],
  fns: {
    list: () => Promise<TRow[]>;
    create: (b: TBody) => Promise<TRow>;
    update: (id: string, b: Partial<TBody>) => Promise<TRow>;
    remove: (id: string) => Promise<unknown>;
    reorder?: (b: ReorderBody) => Promise<unknown>;
  },
  noun: string,
) {
  const useList = () => useQuery({ queryKey: key, queryFn: fns.list });

  const useCreate = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (body: TBody) => fns.create(body),
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: key });
        toast.success(`${noun} created`);
      },
      onError: (e) => toast.error(toMessage(e)),
    });
  };

  const useUpdate = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, body }: { id: string; body: Partial<TBody> }) => fns.update(id, body),
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: key });
        toast.success(`${noun} updated`);
      },
      onError: (e) => toast.error(toMessage(e)),
    });
  };

  const useRemove = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (id: string) => fns.remove(id),
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: key });
        toast.success(`${noun} deleted`);
      },
      onError: (e) => toast.error(toMessage(e)),
    });
  };

  const useReorder = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (body: ReorderBody) => fns.reorder!(body),
      onError: (e) => toast.error(toMessage(e)),
      onSettled: () => void qc.invalidateQueries({ queryKey: key }),
    });
  };

  return { useList, useCreate, useUpdate, useRemove, useReorder };
}

export const banners = makeResource(
  qk.content.banners,
  {
    list: api.content.listBanners,
    create: api.content.createBanner,
    update: api.content.updateBanner,
    remove: api.content.deleteBanner,
    reorder: api.content.reorderBanners,
  },
  'Banner',
);

export const offerStrip = makeResource(
  qk.content.offerStrip,
  {
    list: api.content.listOfferStrip,
    create: api.content.createOfferStripItem,
    update: api.content.updateOfferStripItem,
    remove: api.content.deleteOfferStripItem,
    reorder: api.content.reorderOfferStrip,
  },
  'Offer',
);

export const testimonials = makeResource(
  qk.content.testimonials,
  {
    list: api.content.listTestimonials,
    create: api.content.createTestimonial,
    update: api.content.updateTestimonial,
    remove: api.content.deleteTestimonial,
    reorder: api.content.reorderTestimonials,
  },
  'Testimonial',
);

export const faqs = makeResource(
  qk.content.faqs,
  {
    list: api.content.listFaqs,
    create: api.content.createFaq,
    update: api.content.updateFaq,
    remove: api.content.deleteFaq,
    reorder: api.content.reorderFaqs,
  },
  'FAQ',
);

export const pages = makeResource(
  qk.content.pages,
  {
    list: api.content.listPages,
    create: api.content.createPage,
    update: api.content.updatePage,
    remove: api.content.deletePage,
  },
  'Page',
);

export function useHomepageSections() {
  return useQuery({
    queryKey: qk.content.homepageSections,
    queryFn: api.content.homepageSections,
  });
}
