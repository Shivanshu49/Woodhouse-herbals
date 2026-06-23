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

export const api = {
  homepage: () => apiGet<HomepagePayload>('/homepage'),
  products: (query?: string) =>
    apiGet<ProductListResponse>(`/products${query ? `?${query}` : ''}`),
  product: (slug: string) =>
    apiGet<ProductDetailResponse>(`/products/${encodeURIComponent(slug)}`),
  searchSuggest: (q: string) =>
    apiGet<SearchSuggestResponse>(`/search/suggest?q=${encodeURIComponent(q)}`),
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
