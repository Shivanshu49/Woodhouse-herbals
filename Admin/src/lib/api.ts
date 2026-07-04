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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res = await rawRequest(method, path, body);

  if (!res.ok && shouldAttemptRefresh(res.status, path)) {
    const refreshed = await rawRequest('POST', '/auth/refresh');
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
    adjust: (body: AdjustStockBody) =>
      request<AdjustStockResult>('POST', '/admin/inventory/adjust', body),
  },
  categories: {
    list: () => request<Category[]>('GET', '/categories'),
  },
  concerns: {
    list: () => request<Concern[]>('GET', '/concerns'),
  },
};
