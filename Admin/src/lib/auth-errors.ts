import { ApiError } from './api';

/**
 * Map a failed admin-login attempt to a message the operator can act on.
 *
 * The backend distinguishes these cases (see Backend auth.service.ts):
 *  - 401 Unauthorized — bad credentials, unknown account, or a CUSTOMER-role
 *    account. All three return the SAME message so the login page can't be
 *    used to probe which emails exist.
 *  - 403 Forbidden — the account exists but can't sign in right now: it's
 *    temporarily locked, or its email isn't verified. These messages are
 *    actionable and safe to surface verbatim (423 Locked is handled the same
 *    way in case a proxy ever rewrites the status).
 *  - 429 Too Many Requests — the login throttle tripped.
 *  - 5xx — the API failed; not the operator's fault.
 *  - No ApiError (fetch threw) — the API was unreachable.
 *
 * Never collapse a non-401 into "invalid credentials": a locked-out owner who
 * sees "wrong password" will keep retrying and extend their own lockout.
 */
export function loginErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Invalid email or password.';
    if (err.status === 403 || err.status === 423) {
      return err.message || 'This account can’t sign in right now.';
    }
    if (err.status === 429) {
      return 'Too many attempts. Please wait a minute and try again.';
    }
    if (err.status >= 500) {
      return 'The server ran into a problem. Please try again in a moment.';
    }
    return err.message || 'Could not sign in. Please try again.';
  }
  return 'Couldn’t reach the server. Check your connection and try again.';
}
