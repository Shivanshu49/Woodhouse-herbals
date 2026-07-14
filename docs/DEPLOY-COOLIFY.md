# Deploying Woodhouse to Coolify

Target: a Hostinger KVM VPS running Coolify (Docker + Traefik ingress), behind
Cloudflare. Four resources: **managed Postgres**, **Backend** (`api.`),
**Frontend** (storefront apex), **Admin** (`admin.`). No Redis, no Meilisearch —
both were declared-but-unused and have been removed.

Each app ships a multi-stage `Dockerfile` (in `Backend/`, `Frontend/`, `Admin/`).
In Coolify, create each app as a **Dockerfile** build with the **build context
set to that app's subdirectory** (`Backend`, `Frontend`, `Admin`).

---

## Deploy order (strict)

1. **Postgres** — Coolify **managed** Postgres 16. Grab its internal connection
   string; that becomes the Backend's `DATABASE_URL`.
2. **Backend** — set env (below), deploy. Migrations run automatically:
   `start:prod` is `prisma migrate deploy && node …` (Coolify 4.1.2 has no
   pre-deployment command field). Note its public URL (`api.…`).
3. **Frontend** — set **build args** (esp. `NEXT_PUBLIC_API_URL` = the Backend
   URL) + runtime env, deploy.
4. **Admin** — same, deploy.

Why this order: the Backend needs Postgres to exist first (for `DATABASE_URL` +
migrate). Frontend/Admin bake the Backend's URL into their bundles at build time,
so the Backend's domain must be known first.

---

## ⚠ The two traps

### 1. Migrations vs the boot gate (Backend)
The Backend runs a **boot-time invariant gate** (`assertRequiredPartialIndexes`)
that **`process.exit(1)` in production** if the money-critical partial unique
indexes (`refund_one_active_per_order`, `payment_one_initiated_per_order`) are
absent — and on a fresh Postgres they don't exist until migrations run. So:

- **Migrations are baked into the start command** — Coolify 4.1.2 has NO
  pre-deployment command field (Advanced → Operations only offers Stop Grace
  Period / Max Restart Count), so the image's CMD is `npm run start:prod` =
  `prisma migrate deploy && NODE_ENV=production node dist/src/main.js`. A failed
  migrate exits non-zero and the app never starts; Coolify's restart policy
  retries (`migrate deploy` is idempotent — an actually-failed migration keeps
  failing loudly with P3009 until resolved, it is never skipped).
- The Backend image deliberately keeps the **full `node_modules`** (the Prisma
  CLI is a devDependency and `start:prod` runs it in this image) — do not add
  `--omit=dev`.
- `prisma generate` runs automatically during the image build (`postinstall` at
  `npm ci`; the Dockerfile copies `prisma/` before `npm ci` so the schema is
  present).
- **Never** `prisma db push` — the partial indexes exist only as raw SQL inside
  migrations; a push would silently drop them.

### 2. `NEXT_PUBLIC_*` are BUILD-time, not runtime (Frontend + Admin)
Next.js inlines `NEXT_PUBLIC_*` into the browser bundle at `next build`. Set them
in Coolify as **Build Variables / build args**, NOT just runtime env, or the
`http://localhost:4000` fallback ships to real browsers. The Dockerfiles **fail
the build loudly** if `NEXT_PUBLIC_API_URL` is unset — a failed build beats a
silent localhost leak.

---

## Per-service configuration (env var NAMES only — no values here)

### Backend — `api.woodhouseherbals.com` · port **4000** (honors `PORT`)
- Build: `Backend/Dockerfile`, context `Backend/`. **Build args: none.**
- **Migrations:** automatic — the container start command runs
  `prisma migrate deploy` before booting the app (no pre-deploy field in
  Coolify 4.1.2).
- **Health check:** `/api/health` — **NOT** `/api/health/ready` (that returns
  HTTP 200 even when the DB is down; the body flips to `degraded` but the status
  code lies, so an HTTP probe on `/ready` would never fail).
- **Runtime env — hard-required at boot** (process exits if missing):
  `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (each ≥64 chars and
  must differ from each other), `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
  `RAZORPAY_WEBHOOK_SECRET`, `NODE_ENV=production`.
- **Runtime env — functionally required** (auth/CORS/proxy break without them):
  `WEB_ORIGIN` (the storefront origin, in the CORS allow-list), `ADMIN_ORIGIN`
  (the admin origin), `COOKIE_DOMAIN` (`.woodhouseherbals.com` for
  cross-subdomain cookie auth), `TRUST_PROXY_HOPS` (see below).
- **Runtime env — optional / defaulted:** `PORT`, `JWT_ACCESS_TTL`,
  `JWT_REFRESH_TTL`, `JWT_ADMIN_REFRESH_TTL`, `EMAIL_VERIFICATION_TTL`,
  `PASSWORD_RESET_TTL`, `AUTH_MAX_FAILED_ATTEMPTS`, `AUTH_LOCKOUT_MINUTES`,
  `GST_RATE_PERCENT`, `RESEND_API_KEY`, `EMAIL_FROM`, `MSG91_AUTH_KEY`,
  `MSG91_TEMPLATE_ID`, `GOOGLE_CLIENT_ID`, `CLOUDINARY_CLOUD_NAME`,
  `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `OTP_TTL_SECONDS`,
  `OTP_MAX_ATTEMPTS`, `OTP_REQUESTS_PER_WINDOW`, `RAZORPAY_WEBHOOK_SECRET_OLD`,
  `RECONCILE_PAYMENT_MIN_AGE_MIN`, `REFUND_CONCLUDE_MIN_AGE_MIN`,
  `PAYMENT_ABANDON_TTL_HOURS`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`, `ADMIN_WRITE_TX_TIMEOUT_MS`.

### Frontend — `woodhouseherbals.com` · port **3000** (honors `PORT`)
- Build: `Frontend/Dockerfile`, context `Frontend/`.
- **Build args (inlined into the bundle):**
  - `NEXT_PUBLIC_API_URL` — the Backend public URL. **Build fails if unset.**
  - `NEXT_PUBLIC_AI_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
    (optional).
- **Runtime env (optional — server-side `POST /api/connect`):** `CONNECT_TO_EMAIL`,
  `CONNECT_FROM_EMAIL`, `RESEND_API_KEY`, `CONNECT_LOG_KEY`, `PORT`, `NODE_ENV`.
- **Health check:** `GET /` (no dedicated health route).

### Admin — `admin.woodhouseherbals.com` · port **3001** (honors `PORT`)
- Build: `Admin/Dockerfile`, context `Admin/`.
- **Build args:** `NEXT_PUBLIC_API_URL` (**build fails if unset**),
  `NEXT_PUBLIC_SITE_URL`.
- **Runtime env:** `PORT` (defaults 3001). No server secrets.
- **Health check:** `GET /`.

---

## TRUST_PROXY_HOPS — verify empirically (do not guess)

The request chain is **Cloudflare → Traefik → app**. `TRUST_PROXY_HOPS`
(default 1) sets how many trusted proxy hops the app peels off `X-Forwarded-For`
to derive the real client IP — which drives rate-limiting, `Secure` cookie
logic, and audit IPs. Get it wrong and every request looks like it comes from the
proxy.

After the Backend is up, verify on the **real topology**: make a request and
check a logged client IP (the security logger / an audit row) — it must be the
**real visitor IP**, not a Cloudflare (`104.x`/`172.x`) or Traefik/Docker
(`10.x`/`172.x`) address. If it shows a proxy IP, bump `TRUST_PROXY_HOPS`
(likely `2` behind CF→Traefik) and redeploy. Repeat until the real IP appears.

---

## After deploy — wire the Razorpay webhook

The webhook settlement path and reconciliation cron can only be exercised once
the Backend has a public HTTPS URL Razorpay can reach (impossible on localhost).
In the Razorpay dashboard (Test **and** Live), add a webhook:

- **URL:** `https://api.woodhouseherbals.com/api/razorpay/webhook`
- **Secret:** set the same value as the Backend's `RAZORPAY_WEBHOOK_SECRET`.
- **Events:** `payment.captured`, `payment.failed`, `order.paid`,
  `refund.created`, `refund.processed`, `refund.failed`.

---

## Health-check summary

| Service | Probe | Why |
|---|---|---|
| Backend | `GET /api/health` | Liveness, no DB. **Not** `/api/health/ready` (200 even when DB is down). |
| Frontend | `GET /` | No health route in the app. |
| Admin | `GET /` | No health route in the app. |

## Local build sanity (verified)

```bash
podman build -t woodhouse-backend  Backend/            # 552 MB (keeps Prisma CLI)
podman build -t woodhouse-frontend Frontend/ \
  --build-arg NEXT_PUBLIC_API_URL=https://api.woodhouseherbals.com   # 258 MB
podman build -t woodhouse-admin    Admin/ \
  --build-arg NEXT_PUBLIC_API_URL=https://api.woodhouseherbals.com   # 228 MB
```
Omitting `NEXT_PUBLIC_API_URL` on Frontend/Admin makes the build **fail loudly**
(by design). The root `docker-compose.yml` is **dev-only** (local Postgres/Redis/
Meilisearch) and is not used for this deploy.
