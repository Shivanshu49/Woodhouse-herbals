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
import type { AdminLoginResponse, AdminMeResponse } from '@/types/api';

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
      request<{
        cloudName: string;
        apiKey: string;
        timestamp: number;
        folder: string;
        signature: string;
        uploadUrl: string;
      }>('POST', '/admin/uploads/sign', { folder }),
  },
};
