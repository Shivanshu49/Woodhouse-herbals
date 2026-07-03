# Wood House Herbals — Admin

The store admin panel: a standalone Next.js 14 app that talks to the NestJS
API (`Backend/`) over cookie-based auth. Dev port **3001**.

## Prerequisites

- Node 20 (`.nvmrc`)
- The backend running on `http://localhost:4000` (`cd ../Backend && npm run start:dev`)
- A staff/admin account. Create one from `Backend/`:
  `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' npm run admin:create`

## Run

```bash
npm install
cp .env.example .env       # adjust NEXT_PUBLIC_API_URL if the backend isn't on :4000
npm run dev                # http://localhost:3001
```

## Scripts

- `npm run dev` — dev server on 3001
- `npm run build` / `npm run start` — production build / serve
- `npm run typecheck` — `tsc --noEmit`
- `npm run test` — unit tests (node:test via tsx)
- `npm run lint` — `next lint` (soft)

## Architecture

- Pure API client — no Prisma, no server secrets. All data flows through
  `src/lib/api.ts` (`credentials: 'include'`, automatic 401→refresh→retry).
- Auth: `POST /api/auth/admin-login` (rejects customers); a 30-minute idle
  timeout logs out client-side; the backend enforces a short refresh TTL.
- The auth gate is the `(dashboard)` layout: it calls `GET /api/auth/me` and
  redirects to `/login` for a logged-out or `CUSTOMER`-role session (a
  skeleton renders until that resolves, so protected content never mounts
  first). There is intentionally no Next middleware cookie check — the
  httpOnly cookies are set on the API host and are not visible to the admin
  origin's server, so a middleware gate would false-negative in production.
  The client `/api/auth/me` fetch works because it is same-site with the API.
- Theme: shadcn/ui with a botanical palette (`src/styles/globals.css`),
  light + dark via `next-themes`.
- This is the shell (Phase B). Feature areas (products, orders, …) are stubs
  filled in later phases. Spec: `docs/superpowers/specs/2026-07-03-admin-panel-design.md`.

## Deployment & the cookie-domain decision

**Decision: the admin app and the API share one registrable domain, on
separate subdomains** — `admin.woodhouseherbals.com` (this app) and
`api.woodhouseherbals.com` (the backend). This keeps the hardened httpOnly
cookie auth (rotation, reuse-detection, `SameSite=strict`) with no tokens ever
exposed to JavaScript.

To make it work, set **`COOKIE_DOMAIN=.woodhouseherbals.com`** in the
backend's production environment. The backend then stamps `Domain=.woodhouse
herbals.com` on the `wh_at`/`wh_rt` cookies, so the session is shared across
the storefront and admin subdomains. Also add the admin origin to the
backend's `WEB_ORIGIN`. In dev, leave `COOKIE_DOMAIN` unset — localhost can't
carry a Domain attribute, and `:3001` ↔ `:4000` already share cookies by host.

Why this works without a Next middleware: the auth gate is a client-side
`GET /api/auth/me` fetch from the `(dashboard)` layout. That request targets
the API host and is same-site (shared registrable domain), so `SameSite=strict`
permits it and the cookie is sent. A server-side middleware on the admin origin
would *not* see the cookie unless `COOKIE_DOMAIN` is set — which is the other
reason to set it.

**If you are ever forced onto genuinely unrelated domains** (e.g. throwaway
`*.vercel.app` and `*.railway.app` preview URLs with no shared parent), cookies
cannot be shared at all and this design does not work. The fix is to give both
apps custom subdomains of one parent domain — *not* to fall back to in-memory
bearer tokens, which would forfeit httpOnly protection and require re-auth on
every full page reload. Preview deployments should therefore point the admin
app at an already-authenticated API session or use a shared preview parent
domain.

Deploy as a separate Vercel project with Root Directory `Admin`.
