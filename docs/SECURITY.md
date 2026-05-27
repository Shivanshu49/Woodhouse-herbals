# Wood House Herbals — Security Notes

This is the operator-facing summary of how the application defends itself. It covers authentication, authorisation, abuse protection, input validation, secrets handling, and deployment posture. Keep it up to date when controls change.

## 1. Authentication

| Control | Implementation | File |
|---|---|---|
| Password hashing | `bcryptjs` cost 12 | [Backend/src/common/utils/passwords.ts](../Backend/src/common/utils/passwords.ts) |
| Password policy | 10+ chars, mixed case, digit, common-password blocklist | same |
| Timing-safe login | Bcrypt compare even on unknown email | [Backend/src/modules/auth/auth.service.ts](../Backend/src/modules/auth/auth.service.ts) |
| Account lockout | 5 failures → 30-minute lock (env-tunable) | same |
| Login throttle | 10 / 15 min / IP via `@Throttle` + global guard | [Backend/src/modules/auth/auth.controller.ts](../Backend/src/modules/auth/auth.controller.ts) |
| Email verification | Required before login. 24-h TTL, single-use, hashed at rest | service + Prisma |
| Password reset | 1-h TTL, single-use, hashed at rest; existing sessions revoked | same |
| Session model | Short-lived access JWT (15 min) + rotating refresh (30 d) | auth service |
| Refresh rotation | Each refresh issues a new token + revokes the previous one. Reuse-after-rotation burns the whole family. | same |
| Cookies | `HttpOnly`, `Secure` in prod, `SameSite=Strict` in prod / `Lax` in dev. Refresh cookie scoped to `/api/auth`. | auth controller |
| Secrets | Validated by Zod at boot. Production rejects placeholder values. | [Backend/src/common/config/env.ts](../Backend/src/common/config/env.ts) |

## 2. Authorisation

- **Default-secure**: a global `JwtAuthGuard` is registered in [main.ts](../Backend/src/main.ts). Every endpoint requires a valid access cookie unless explicitly marked with `@Public()`.
- **Role guard**: `@Roles(UserRole.ADMIN)` plus `RolesGuard` for staff endpoints.
- **Ownership enforcement**: each resource controller verifies the caller owns the data:
  - `GET /api/orders/:number` → `OrdersService.findOwnedByNumber` returns 404 when the caller is neither the order's user nor staff. Order numbers include 24 bits of randomness so they cannot be enumerated.
  - `GET /api/orders` lists only the caller's orders.
  - `POST /api/customers/wishlist/:productId` is scoped to `req.user.sub` (bug fix — productId was previously unbound).
  - Reviews are tied to `req.user.sub` server-side; `verifiedPurchase` is derived from order history (cannot be claimed by the client).
- **PhonePe**: `POST /api/phonepe/initiate` requires auth and validates that the redirect URL belongs to `WEB_ORIGIN`. `POST /api/phonepe/callback` is the webhook — public, but authenticated by HMAC `X-VERIFY` signature.

## 3. Input validation

- All request bodies go through `class-validator` with `whitelist`, `forbidNonWhitelisted`, and `transform`. Unknown fields are stripped; extra keys reject the request.
- DTOs enforce strict character classes for free-form text (`/^[\p{L}\p{M}\p{N}\s,.'/\-#&()]+$/u`) — rejects control characters, RTL overrides, HTML/JS payloads.
- Indian-format checks for phone (`/^[6-9]\d{9}$/`) and pincode (`/^[1-9]\d{5}$/`).
- Slugs, ids, order numbers validated at the controller boundary with anchored regexes.
- Body size capped at 256 KB by Express; the AI service caps at 32 KB.
- Search input length is clamped to 80 characters to prevent CPU abuse.
- Prisma is used everywhere — queries are parameterised, no string-built SQL. The only raw query is `SELECT 1` in the readiness probe.

## 4. Abuse protection (rate limits)

Per-IP limits via `@nestjs/throttler`:

| Endpoint | Limit |
|---|---|
| Global default | 120 / minute / IP |
| `POST /api/auth/register` | 3 / hour |
| `POST /api/auth/login` | 10 / 15 min |
| `POST /api/auth/refresh` | 30 / minute |
| `POST /api/auth/forgot-password` | 3 / 15 min |
| `POST /api/auth/reset-password` | 5 / 15 min |
| `POST /api/auth/change-password` | 5 / 15 min |
| `GET /api/search/suggest` | 60 / minute |
| `POST /api/cart/items` | 60 / minute |
| `POST /api/reviews` | 5 / hour / user |
| `POST /api/phonepe/initiate` | 10 / 10 min |

AI service (slowapi):

| Endpoint | Limit |
|---|---|
| `POST /v1/skin-analysis` | 10 / minute + 100 / hour / IP |
| All endpoints (default) | 120 / minute / IP |

## 5. Audit logging

`AuthEvent` table is an append-only log of security events. Recorded via [SecurityEventsService](../Backend/src/common/security/security-events.service.ts):

`REGISTER`, `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGOUT`, `REFRESH_SUCCESS`, `REFRESH_REUSE_DETECTED`, `PASSWORD_CHANGED`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`, `EMAIL_VERIFIED`, `ACCOUNT_LOCKED`.

Each event captures `userId`, `ip`, `userAgent`, and a free-form `meta` JSON for the reason. **Never** log raw passwords, tokens, or full request bodies.

In parallel, the [SecurityLoggerInterceptor](../Backend/src/common/security/security-logger.interceptor.ts) emits one structured JSON line per HTTP request with status, duration, IP, UA, and `userId`. 401/403/429/5xx are escalated to `warn`/`error` so SIEM alerts can fire automatically. Query-string tokens (`?token=…`) are redacted in case a reset link is hit via GET.

## 6. Secrets management

- All secrets read from environment variables; none are committed to the repository.
- Boot fails loud if any of `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, or `DATABASE_URL` is missing, too short, or matches a placeholder.
- The Frontend never receives backend secrets. Only `NEXT_PUBLIC_*` variables (URLs only) are sent to the browser bundle.
- The AI service's `ANTHROPIC_API_KEY` lives only inside the AI container and is never returned to the caller — even error responses are sanitised.
- `.env*` files are gitignored. `.env.example` is the canonical template.

## 7. Network / deployment

- HTTPS-only in production via `HSTS: max-age=31536000; includeSubDomains; preload`.
- `upgradeInsecureRequests` CSP directive prevents accidental http://.
- `frame-ancestors 'none'` blocks clickjacking.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(), camera=(), microphone=()`.
- CORS is a strict allow-list (`WEB_ORIGIN` env, comma-separated). No wildcard.
- `trust proxy` is set so the rate limiter and audit log see the real client IP behind the LB / Cloudflare.
- Database is reachable only from the application subnet — do not expose port 5432 publicly. The Prisma DSN should use TLS in production.
- Redis is private-only (used for BullMQ background jobs).
- Cloudflare R2 buckets serve only the public CDN URL; signed URLs for private assets.

## 8. Things still to do (next iteration)

- Switch refresh-token sessions to per-device named sessions in the account UI (revoke from "Active sessions").
- Add a `device_fingerprint` to refresh rotation to short-circuit cookie theft across devices.
- Add a SecurityHeadersInterceptor for the few hand-written Express handlers (currently inherits from helmet, which is sufficient).
- Wire HaveIBeenPwned k-anonymity API to the password strength check.
- WAF in front of the API (Cloudflare or AWS WAF) for L7 DDoS + known-bad IP lists.
- Quarterly external pentest + dependency scan in CI (`npm audit --omit=dev`, `pip-audit`).

## 9. Incident response checklist

If a credential is suspected leaked:

1. Rotate the affected secret in the secrets manager.
2. Redeploy — the new value is read at boot, env validation refuses placeholder defaults.
3. For JWT secret rotation: deploy with the new secret, all refresh tokens minted with the old secret get rejected on the next call (users re-log-in).
4. For database credential rotation: rotate, redeploy, restart the connection pool.
5. Query `AuthEvent` for `LOGIN_FAILURE` / `REFRESH_REUSE_DETECTED` clusters around the suspected window; force a password change for affected accounts.
