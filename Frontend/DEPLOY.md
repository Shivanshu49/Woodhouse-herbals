# Deploying the Frontend to Vercel

The storefront is a **Next.js 14 (App Router) server build**. It renders fully
from bundled mock data (`src/data/*`), so it deploys and works **without the
backend or AI-Service**. The only live-backend touchpoint (SmartSearch's catalog
fetch) silently falls back to mock data when no backend is reachable.

- Node is pinned to **20.x** (`engines` in `package.json`, `.nvmrc`).
- Verified: `npm run build` succeeds and prerenders all 20 routes.

## Deploy via the Vercel dashboard (recommended)

1. Go to <https://vercel.com> → **Add New… → Project** → import
   `Shivanshu49/Woodhouse-herbals`.
2. **Root Directory: `Frontend`** (this repo has no monorepo wrapper; the app
   lives in the `Frontend/` subfolder). Click *Edit* next to Root Directory and
   select `Frontend`.
3. Framework Preset auto-detects **Next.js**. Leave Build/Output/Install at the
   defaults (`next build`, `.next`, `npm ci`). Node 20 is read from `engines`.
4. **Environment Variables** — optional. Leave them unset to run on mock data.
   See the table below before setting `NEXT_PUBLIC_API_URL`.
5. **Deploy.** You'll get a `https://<project>.vercel.app` URL in ~2 minutes.
   Every push to `main` then auto-deploys; PRs get preview URLs.

## Deploy via CLI (alternative)

```bash
cd Frontend
npx vercel          # first run: links the project, set Root Directory = ./
npx vercel --prod   # production deploy
```

## Environment variables

All are `NEXT_PUBLIC_*`, which means they are **inlined at build time** — changing
one requires a **redeploy/rebuild**, not just a settings save.

| Var | Needed? | Notes |
|-----|---------|-------|
| `NEXT_PUBLIC_API_URL` | Only to wire a live backend | Base URL of the NestJS API (no trailing `/api`). Unset → defaults to `http://localhost:4000`, so the live catalog/search just falls back to mock data. Set this **before** the build that should use it. |
| `NEXT_PUBLIC_SITE_URL` | Optional | Canonical public site URL. |
| `NEXT_PUBLIC_AI_URL` | Not used | Placeholder; the AI-Service isn't called by any code yet. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Only for "Sign in with Google" | OAuth **Web** client id from Google Cloud Console → Credentials. The same value must be set as `GOOGLE_CLIENT_ID` on the backend. Unset → the Google button simply doesn't render. Add your Vercel origin (and `http://localhost:3000`) to the client's *Authorized JavaScript origins*. |

> ⚠️ Backend calls use `credentials: 'include'`, and failures are swallowed
> (silent mock fallback). If you later point `NEXT_PUBLIC_API_URL` at a real
> backend, that backend's `WEB_ORIGIN` must include this Vercel origin (CORS with
> credentials) or the catalog will *appear* to work while silently serving mocks.

## Accounts / auth (login, signup, profile)

The `/login`, `/signup` and `/account` pages talk to the NestJS backend, so they
need `NEXT_PUBLIC_API_URL` pointing at a deployed backend whose `WEB_ORIGIN`
includes this site's origin. Auth rides on httpOnly cookies:

- **Cookies are `SameSite=strict` in production**, so the backend must be served
  from the **same site** as the storefront (e.g. `api.woodhouseherbals.com` next
  to `woodhouseherbals.com`). A `*.vercel.app` frontend with a backend on a
  different domain will not keep sessions.
- **Phone OTP SMS** needs `MSG91_AUTH_KEY` + `MSG91_TEMPLATE_ID` on the backend.
  Without them, dev echoes the code back into the UI ("Dev mode — your code is…")
  and production returns 503 for phone sign-in.
- **Google sign-in** needs `GOOGLE_CLIENT_ID` on the backend and
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (same value) here.
- **Email verification / password reset** emails need `RESEND_API_KEY` on the
  backend. Without it (dev), new email accounts are auto-verified so the flow
  stays testable.

## Gotchas

- **Not a static export.** Don't deploy to a plain static host; it needs Vercel's
  Node runtime (the default for the Next.js preset).
- **Images.** `next.config.mjs` `remotePatterns` only allow-lists
  `images.unsplash.com` and `*.woodhouseherbals.com`. Current product images are
  local files under `public/products/`, so this is fine — only matters if you add
  remote image hosts (add them to `remotePatterns` or `next/image` 500s).
- **Custom domain.** Add it under Project → Settings → Domains; Vercel issues TLS
  automatically.
