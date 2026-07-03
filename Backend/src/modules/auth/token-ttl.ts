import type { UserRole } from '@prisma/client';
import { env } from '../../common/config/env';

/**
 * Staff/admin sessions use a much shorter refresh TTL than customers. Each
 * rotation re-issues a full-TTL refresh token, so an ACTIVE admin session
 * slides forward indefinitely while an IDLE one hard-expires server-side
 * within JWT_ADMIN_REFRESH_TTL (default 60 min). The admin app's 30-minute
 * idle timer logs out sooner; this is the server-enforced backstop.
 */
export function refreshTtlSecondsForRole(role: UserRole): number {
  return role === 'CUSTOMER' ? env.JWT_REFRESH_TTL : env.JWT_ADMIN_REFRESH_TTL;
}
