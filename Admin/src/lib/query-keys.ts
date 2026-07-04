import type { AdminProductListParams } from '@/types/product';

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
  },
  categories: ['categories'] as const,
};
