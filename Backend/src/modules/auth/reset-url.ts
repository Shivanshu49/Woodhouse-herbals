import type { UserRole } from '@prisma/client';

/**
 * Staff/manager/admin accounts get reset links pointing at the admin app
 * (when ADMIN_ORIGIN is configured); customers keep the storefront page.
 * The storefront origin is the FIRST entry of the comma-separated
 * WEB_ORIGIN list — the same convention the email-verification link uses.
 */
export function passwordResetUrl(
  role: UserRole,
  token: string,
  webOrigin: string,
  adminOrigin?: string,
): string {
  const encoded = encodeURIComponent(token);
  if (role !== 'CUSTOMER' && adminOrigin) {
    return `${adminOrigin.replace(/\/+$/, '')}/reset?token=${encoded}`;
  }
  const base = (webOrigin.split(',')[0] ?? '').trim().replace(/\/+$/, '');
  return `${base}/account/reset?token=${encoded}`;
}
