/**
 * Typed HTTP client for the Wood House Herbals backend.
 *
 * This is the single integration seam between the storefront and the NestJS
 * API. Every call is typed against the shared contract in `@/types/api`, which
 * the static `src/data/*` modules are already shaped to satisfy — so callers
 * can transparently fall back to mock data (see `withFallback`) while the
 * backend is still being wired up or is unreachable in local dev.
 *
 * Cookies are always sent (`credentials: 'include'`) because auth and the cart
 * session ride on httpOnly cookies set by the backend.
 */
import { env } from './env';
import type {
  HomepagePayload,
  ProductListResponse,
  ProductDetailResponse,
  SearchSuggestResponse,
} from '@/types/api';
import type { Cart } from '@/types/cart';
import type {
  Order,
  CheckoutAddress,
  InitiateResponse,
  VerifyPayload,
  VerifyResponse,
} from '@/types/order';
import type {
  AddressInput,
  AuthUser,
  CustomerAddress,
  CustomerOrder,
  CustomerProfile,
} from '@/types/auth';

// The backend mounts everything under the `/api` global prefix (see
// Backend/src/main.ts → setGlobalPrefix('api')).
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

async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* non-JSON error body — keep the status-based message */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

async function apiSend<T>(
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(extraHeaders ?? {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const parsed = (await res.json()) as { message?: string | string[] };
      if (parsed?.message) {
        message = Array.isArray(parsed.message) ? parsed.message.join(' ') : parsed.message;
      }
    } catch {
      /* non-JSON error body — keep the status-based message */
    }
    throw new ApiError(res.status, message);
  }
  // 204 No Content (logout) has no body.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  homepage: () => apiGet<HomepagePayload>('/homepage'),
  products: (query?: string) =>
    apiGet<ProductListResponse>(`/products${query ? `?${query}` : ''}`),
  product: (slug: string) =>
    apiGet<ProductDetailResponse>(`/products/${encodeURIComponent(slug)}`),
  searchSuggest: (q: string) =>
    apiGet<SearchSuggestResponse>(`/search/suggest?q=${encodeURIComponent(q)}`),

  // Guest cart, keyed by the httpOnly `wh_sid` cookie (credentials:'include'
  // round-trips it). Every method returns the authoritative server cart
  // (`toResponse` shape) — the client store reconciles to it. `addItem` is
  // INCREMENT semantics server-side; `setQuantity` is an absolute write and
  // quantity 0 removes the line.
  cart: {
    get: () => apiGet<Cart>('/cart'),
    addItem: (input: { productId: string; quantity: number }) =>
      apiSend<Cart>('POST', '/cart/items', input),
    setQuantity: (productId: string, quantity: number) =>
      apiSend<Cart>('PUT', `/cart/items/${encodeURIComponent(productId)}`, { quantity }),
    clear: () => apiSend<Cart>('DELETE', '/cart'),
  },

  orders: {
    // POST /orders — body is EXACTLY the address + optional coupon (server
    // re-prices; never send client money). The Idempotency-Key makes a literal
    // retry replay the same order; an edited resubmit uses a different key.
    create: (body: CheckoutAddress, idempotencyKey: string) =>
      apiSend<Order>('POST', '/orders', body, { 'Idempotency-Key': idempotencyKey }),
    // GET /orders/:number — guest-ownable via the wh_sid cookie; polled for
    // PENDING → PAID on the result page.
    get: (orderNumber: string) => apiGet<Order>(`/orders/${encodeURIComponent(orderNumber)}`),
  },

  razorpay: {
    initiate: (orderNumber: string) =>
      apiSend<InitiateResponse>('POST', '/razorpay/initiate', { orderNumber }),
    verify: (payload: VerifyPayload) =>
      apiSend<VerifyResponse>('POST', '/razorpay/verify', payload),
  },

  auth: {
    register: (data: { email: string; fullName: string; password: string }) =>
      apiSend<{ user: Pick<AuthUser, 'id' | 'email' | 'fullName' | 'role'> }>('POST', '/auth/register', data),
    login: (data: { email: string; password: string }) =>
      apiSend<{ user: AuthUser }>('POST', '/auth/login', data),
    logout: () => apiSend<void>('POST', '/auth/logout'),
    otpRequest: (phone: string) =>
      apiSend<{ ok: true; ttlSeconds: number; devCode?: string }>('POST', '/auth/otp/request', { phone }),
    otpVerify: (data: { phone: string; code: string; fullName?: string }) =>
      apiSend<{ user: AuthUser }>('POST', '/auth/otp/verify', data),
    google: (credential: string) =>
      apiSend<{ user: AuthUser }>('POST', '/auth/google', { credential }),
    verifyEmail: (token: string) => apiSend<{ ok: true }>('POST', '/auth/verify-email', { token }),
    forgotPassword: (email: string) =>
      apiSend<{ ok: true }>('POST', '/auth/forgot-password', { email }),
    resetPassword: (data: { token: string; password: string }) =>
      apiSend<{ ok: true }>('POST', '/auth/reset-password', data),
    // Verified phone change (phone is a login identifier): request a code
    // to the NEW number, then verify it. Signed-in users only.
    phoneChangeRequest: (phone: string) =>
      apiSend<{ ok: true; ttlSeconds: number; devCode?: string }>('POST', '/auth/phone-change/request', { phone }),
    phoneChangeVerify: (data: { phone: string; code: string }) =>
      apiSend<{ ok: true; phone: string }>('POST', '/auth/phone-change/verify', data),
  },

  customer: {
    profile: () => apiGet<CustomerProfile>('/customers/me'),
    updateProfile: (data: Partial<Pick<CustomerProfile, 'fullName' | 'skinType' | 'primaryConcerns'>>) =>
      apiSend<CustomerProfile>('PATCH', '/customers/me', data),
    createAddress: (data: AddressInput) =>
      apiSend<CustomerAddress>('POST', '/customers/me/addresses', data),
    updateAddress: (id: string, data: AddressInput) =>
      apiSend<CustomerAddress>('PATCH', `/customers/me/addresses/${encodeURIComponent(id)}`, data),
    deleteAddress: (id: string) =>
      apiSend<{ ok: true }>('DELETE', `/customers/me/addresses/${encodeURIComponent(id)}`),
    setDefaultAddress: (id: string) =>
      apiSend<{ ok: true }>('POST', `/customers/me/addresses/${encodeURIComponent(id)}/default`),
    orders: () => apiGet<CustomerOrder[]>('/orders'),
  },
};

/**
 * Run a live API call, transparently falling back to a local value if it
 * fails (backend down, CORS, network error, non-2xx). This lets the storefront
 * stay fully functional on mock data today and light up against the real API
 * the moment it is reachable — no component changes required.
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  try {
    return await primary();
  } catch {
    return await fallback();
  }
}
