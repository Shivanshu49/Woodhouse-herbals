import type { AdminProductListParams } from '@/types/product';
import type { AdminOrderListParams } from '@/types/order';

/**
 * Central react-query key factory. Every query/mutation references a key
 * from here so invalidations stay consistent across the app.
 */
export const qk = {
  me: ['auth', 'me'] as const,
  dashboardStats: ['dashboard', 'stats'] as const,
  products: {
    /** Prefix key — invalidate/patch every product-list view at once. */
    all: ['products', 'list'] as const,
    /** Per-view key: caching + `keepPreviousData` work per filter/sort/page. */
    list: (params: AdminProductListParams) => ['products', 'list', params] as const,
    /** Single product detail (edit prefill). */
    detail: (id: string) => ['products', 'detail', id] as const,
  },
  orders: {
    /** Prefix key — invalidate every order-list view at once. */
    all: ['orders', 'list'] as const,
    list: (params: AdminOrderListParams) => ['orders', 'list', params] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
  },
  categories: ['categories'] as const,
  concerns: ['concerns'] as const,
  content: {
    banners: ['content', 'banners'] as const,
    offerStrip: ['content', 'offer-strip'] as const,
    testimonials: ['content', 'testimonials'] as const,
    faqs: ['content', 'faqs'] as const,
    pages: ['content', 'pages'] as const,
    homepageSections: ['content', 'homepage-sections'] as const,
  },
  coupons: {
    all: ['coupons'] as const,
    detail: (id: string) => ['coupons', 'detail', id] as const,
  },
};
