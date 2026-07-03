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

## Deployment

Deploy as a separate Vercel project (Root Directory `Admin`) at
`admin.woodhouseherbals.com` — it must be same-site with the API
(`api.woodhouseherbals.com`) because auth cookies are `SameSite=strict`. Add
the admin origin to the backend's `WEB_ORIGIN`.
