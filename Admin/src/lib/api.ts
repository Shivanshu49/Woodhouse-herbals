/**
 * Typed HTTP client for the Wood House Herbals admin panel.
 *
 * Differences from the storefront client:
 *  - NO withFallback: the admin surfaces API failures, never masks them.
 *  - A single automatic 401 → POST /auth/refresh → retry-once. Admin
 *    sessions outlive the 15-min access token; this keeps active sessions
 *    alive without the user seeing a logout. The refresh cookie is rotated
 *    by the backend (Phase A). If refresh itself fails, the original 401
 *    propagates and the auth layer redirects to /login.
 */
import { env } from './env';
import type { SignResponse } from './cloudinary-upload';
import type { AdminLoginResponse, AdminMeResponse } from '@/types/api';
import type {
  AdjustStockBody,
  AdjustStockResult,
  AdminProductListParams,
  AdminProductsList,
  BulkProductsBody,
  BulkProductsResult,
  Category,
  Concern,
  ProductDetail,
} from '@/types/product';
import type {
  AdminCategory,
  CreateCategoryBody,
  UpdateCategoryBody,
  ReorderCategoriesBody,
} from '@/types/admin-category';
import type { InventoryList, InventoryMovement } from '@/types/inventory';
import type {
  StoreProfile,
  StoreProfilePatch,
  IntegrationsStatus,
  StaffUser,
  CreateStaffBody,
  CreateStaffResult,
  UpdateStaffBody,
} from '@/types/settings';
import type {
  InvoiceMeta,
  ManualRefundBody,
  RefundBody,
  AddOrderNoteBody,
  AdminOrderListParams,
  AdminOrdersList,
  CancelOrderBody,
  OrderDetail,
} from '@/types/order';
import type {
  HeroBanner,
  OfferStripItem,
  Testimonial,
  Faq,
  StaticPage,
  HomepageSections,
  BannerBody,
  OfferStripBody,
  TestimonialBody,
  FaqBody,
  StaticPageBody,
  ReorderBody,
} from '@/types/content';

const API_BASE = `${env.apiUrl}/api`;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Decide whether a failed response should trigger one refresh+retry.
 * Only 401s, and never for the refresh call itself or the login call
 * (a 401 there means bad credentials, not a stale access token).
 */
export function shouldAttemptRefresh(status: number, path: string): boolean {
  if (status !== 401) return false;
  if (path.startsWith('/auth/refresh')) return false;
  if (path.startsWith('/auth/admin-login')) return false;
  if (path.startsWith('/auth/login')) return false;
  return true;
}

async function parseError(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (body?.message) {
      message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
    }
  } catch {
    /* non-JSON error body — keep the status-based message */
  }
  return new ApiError(res.status, message);
}

async function rawRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/** Serialise a params object to a query string, dropping empty values. */
function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    usp.set(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

// Single-flight refresh: the admin app fires several queries at once, so an
// expired access token yields concurrent 401s. Without deduping, each fires its
// own POST /auth/refresh; the backend rotates the refresh token and treats the
// second (now-stale) presentation as reuse — revoking the whole family and
// force-logging-out the user. One shared in-flight refresh avoids that.
let refreshInFlight: Promise<Response> | null = null;
function refreshOnce(): Promise<Response> {
  if (!refreshInFlight) {
    refreshInFlight = rawRequest('POST', '/auth/refresh').finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res = await rawRequest(method, path, body);

  if (!res.ok && shouldAttemptRefresh(res.status, path)) {
    const refreshed = await refreshOnce();
    if (refreshed.ok) {
      res = await rawRequest(method, path, body);
    }
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  auth: {
    adminLogin: (data: { email: string; password: string }) =>
      request<AdminLoginResponse>('POST', '/auth/admin-login', data),
    me: () => request<AdminMeResponse>('GET', '/auth/me'),
    logout: () => request<void>('POST', '/auth/logout'),
    refresh: () => request<{ ok: true }>('POST', '/auth/refresh'),
    forgotPassword: (email: string) =>
      request<{ ok: true }>('POST', '/auth/forgot-password', { email }),
    resetPassword: (data: { token: string; password: string }) =>
      request<{ ok: true }>('POST', '/auth/reset-password', data),
  },
  uploads: {
    sign: (folder: 'products' | 'banners' | 'content') =>
      request<SignResponse>('POST', '/admin/uploads/sign', { folder }),
    // Delete-on-remove: called the moment an image uploaded this session is
    // removed, so it is never orphaned in Cloudinary. Server-scoped to our
    // own woodhouse/ folders (see DeleteUploadDto).
    delete: (publicId: string) =>
      request<{ result: string }>('POST', '/admin/uploads/delete', { publicId }),
  },
  products: {
    list: (params: AdminProductListParams) =>
      request<AdminProductsList>(
        'GET',
        `/admin/products${toQuery(params as Record<string, string | number | boolean | undefined>)}`,
      ),
    slugCheck: (slug: string, excludeId?: string) =>
      request<{ available: boolean }>(
        'GET',
        `/admin/products/slug-check${toQuery({ slug, excludeId })}`,
      ),
    get: (id: string) => request<ProductDetail>('GET', `/admin/products/${id}`),
    create: (body: unknown) => request<{ id: string }>('POST', '/admin/products', body),
    update: (id: string, body: unknown) => request<{ id: string }>('PATCH', `/admin/products/${id}`, body),
    bulk: (body: BulkProductsBody) =>
      request<BulkProductsResult>('POST', '/admin/products/bulk', body),
    // Soft-delete (sets deletedAt). The catalog keeps the row for order history.
    remove: (id: string) => request<{ ok: true }>('DELETE', `/admin/products/${id}`),
    restore: (id: string) => request<{ ok: true }>('POST', `/admin/products/${id}/restore`),
  },
  inventory: {
    overview: (params: { q?: string; lowStockOnly?: boolean; page?: number; perPage?: number }) =>
      request<InventoryList>('GET', `/admin/inventory${toQuery(params as Record<string, string | number | boolean | undefined>)}`),
    history: (productId: string) => request<InventoryMovement[]>('GET', `/admin/inventory/${productId}/history`),
    adjust: (body: AdjustStockBody) =>
      request<AdjustStockResult>('POST', '/admin/inventory/adjust', body),
  },
  categories: {
    list: () => request<Category[]>('GET', '/categories'),
  },
  concerns: {
    list: () => request<Concern[]>('GET', '/concerns'),
  },
  orders: {
    list: (params: AdminOrderListParams) =>
      request<AdminOrdersList>(
        'GET',
        `/admin/orders${toQuery(params as Record<string, string | number | boolean | undefined>)}`,
      ),
    get: (id: string) => request<OrderDetail>('GET', `/admin/orders/${id}`),
    addNote: (id: string, body: AddOrderNoteBody) =>
      request<{ id: string }>('POST', `/admin/orders/${id}/notes`, body),
    cancel: (id: string, body: CancelOrderBody) =>
      request<{ id: string; status: string }>('POST', `/admin/orders/${id}/cancel`, body),
    refund: (id: string, body: RefundBody) =>
      request<{ id: string; status: string }>('POST', `/admin/orders/${id}/refund`, body),
    manualRefund: (id: string, body: ManualRefundBody) =>
      request<{ id: string; status: string }>('POST', `/admin/orders/${id}/refund/manual`, body),
    recheckRefund: (id: string) =>
      request<{ id: string; state: string }>('POST', `/admin/orders/${id}/refund/recheck`, {}),
    getInvoice: (id: string) =>
      request<InvoiceMeta | null>('GET', `/admin/orders/${id}/invoice`),
    generateInvoice: (id: string) =>
      request<InvoiceMeta>('POST', `/admin/orders/${id}/invoice`),
    /** Streams the PDF as a Blob via the credentialed client — httpOnly cookies
     *  won't ride a cross-origin <a href> in prod; a blob download does. Routes
     *  through the same single-flight silent refresh as request() so an expired
     *  access token transparently refreshes + retries (not a lone hard failure). */
    invoicePdf: async (id: string): Promise<Blob> => {
      const path = `/admin/orders/${id}/invoice/pdf`;
      const fetchPdf = () => fetch(`${API_BASE}${path}`, { credentials: 'include' });
      let res = await fetchPdf();
      if (!res.ok && shouldAttemptRefresh(res.status, path)) {
        const refreshed = await refreshOnce();
        if (refreshed.ok) res = await fetchPdf();
      }
      if (!res.ok) throw new ApiError(res.status, 'Failed to download invoice');
      return res.blob();
    },
  },
  adminCategories: {
    list: () => request<AdminCategory[]>('GET', '/admin/categories'),
    slugCheck: (slug: string, excludeId?: string) =>
      request<{ available: boolean }>('GET', `/admin/categories/slug-check${toQuery({ slug, excludeId })}`),
    create: (body: CreateCategoryBody) => request<AdminCategory>('POST', '/admin/categories', body),
    update: (id: string, body: UpdateCategoryBody) => request<AdminCategory>('PATCH', `/admin/categories/${id}`, body),
    reorder: (body: ReorderCategoriesBody) => request<{ ok: true }>('PATCH', '/admin/categories/reorder', body),
    remove: (id: string) => request<{ id: string; deleted: true }>('DELETE', `/admin/categories/${id}`),
  },
  settings: {
    getStore: () => request<StoreProfile>('GET', '/admin/settings/store'),
    updateStore: (body: StoreProfilePatch) => request<StoreProfile>('PATCH', '/admin/settings/store', body),
    integrations: () => request<IntegrationsStatus>('GET', '/admin/settings/integrations'),
  },
  users: {
    list: () => request<StaffUser[]>('GET', '/admin/users'),
    create: (body: CreateStaffBody) => request<CreateStaffResult>('POST', '/admin/users', body),
    update: (id: string, body: UpdateStaffBody) => request<StaffUser>('PATCH', `/admin/users/${id}`, body),
  },
  content: {
    // Hero banners
    listBanners: () => request<HeroBanner[]>('GET', '/admin/content/banners'),
    createBanner: (body: BannerBody) => request<HeroBanner>('POST', '/admin/content/banners', body),
    updateBanner: (id: string, body: Partial<BannerBody>) =>
      request<HeroBanner>('PATCH', `/admin/content/banners/${id}`, body),
    deleteBanner: (id: string) => request<{ id: string; deleted: true }>('DELETE', `/admin/content/banners/${id}`),
    reorderBanners: (body: ReorderBody) => request<{ ok: true }>('PATCH', '/admin/content/banners/reorder', body),
    // Offer strip
    listOfferStrip: () => request<OfferStripItem[]>('GET', '/admin/content/offer-strip'),
    createOfferStripItem: (body: OfferStripBody) => request<OfferStripItem>('POST', '/admin/content/offer-strip', body),
    updateOfferStripItem: (id: string, body: Partial<OfferStripBody>) =>
      request<OfferStripItem>('PATCH', `/admin/content/offer-strip/${id}`, body),
    deleteOfferStripItem: (id: string) =>
      request<{ id: string; deleted: true }>('DELETE', `/admin/content/offer-strip/${id}`),
    reorderOfferStrip: (body: ReorderBody) => request<{ ok: true }>('PATCH', '/admin/content/offer-strip/reorder', body),
    // Testimonials
    listTestimonials: () => request<Testimonial[]>('GET', '/admin/content/testimonials'),
    createTestimonial: (body: TestimonialBody) => request<Testimonial>('POST', '/admin/content/testimonials', body),
    updateTestimonial: (id: string, body: Partial<TestimonialBody>) =>
      request<Testimonial>('PATCH', `/admin/content/testimonials/${id}`, body),
    deleteTestimonial: (id: string) =>
      request<{ id: string; deleted: true }>('DELETE', `/admin/content/testimonials/${id}`),
    reorderTestimonials: (body: ReorderBody) =>
      request<{ ok: true }>('PATCH', '/admin/content/testimonials/reorder', body),
    // FAQs
    listFaqs: () => request<Faq[]>('GET', '/admin/content/faqs'),
    createFaq: (body: FaqBody) => request<Faq>('POST', '/admin/content/faqs', body),
    updateFaq: (id: string, body: Partial<FaqBody>) => request<Faq>('PATCH', `/admin/content/faqs/${id}`, body),
    deleteFaq: (id: string) => request<{ id: string; deleted: true }>('DELETE', `/admin/content/faqs/${id}`),
    reorderFaqs: (body: ReorderBody) => request<{ ok: true }>('PATCH', '/admin/content/faqs/reorder', body),
    // Static pages
    listPages: () => request<StaticPage[]>('GET', '/admin/content/pages'),
    getPage: (id: string) => request<StaticPage>('GET', `/admin/content/pages/${id}`),
    createPage: (body: StaticPageBody) => request<StaticPage>('POST', '/admin/content/pages', body),
    updatePage: (id: string, body: Partial<StaticPageBody>) =>
      request<StaticPage>('PATCH', `/admin/content/pages/${id}`, body),
    deletePage: (id: string) => request<{ id: string; deleted: true }>('DELETE', `/admin/content/pages/${id}`),
    // Homepage sections overview (read-only)
    homepageSections: () => request<HomepageSections>('GET', '/admin/content/homepage-sections'),
  },
};
