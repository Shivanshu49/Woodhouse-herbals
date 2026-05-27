import type { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  sub: string;     // user id
  email: string;
  role: UserRole;
  tokenJti: string; // unique id of this access token (for audit)
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  jti: string;
  kind: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  email: string;
  jti: string;
  fam: string;     // family id for rotation/reuse detection
  kind: 'refresh';
}

export const ACCESS_COOKIE = 'wh_at';
export const REFRESH_COOKIE = 'wh_rt';
export const SESSION_COOKIE = 'wh_sid';

// Request.user is augmented in src/types/express.d.ts (kept in a .d.ts so
// the ambient module declaration is picked up regardless of import order).
