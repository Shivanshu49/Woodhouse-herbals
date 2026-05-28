# Wood House Herbals

Modern, premium, mobile-first natural skincare e-commerce platform for **Wood House Herbals** (by VedicGlory Healthcare). Three independent services covering the storefront, commerce API, and an optional AI recommendation service.

## Project layout

```
Woodhouse-herbals/
├── Frontend/           Next.js 14 (App Router) + TypeScript + Tailwind + Zustand + TanStack Query
├── Backend/            NestJS + Prisma + PostgreSQL + JWT cookies + Redis/BullMQ
├── AI-Service/         FastAPI service for skin/hair concern analysis (Claude)
├── docs/               Architecture, security & build-order notes
├── docker-compose.yml  Local Postgres / Redis / Meilisearch
├── .env.docker         docker-compose env template (committed)
└── .github/workflows/  CI: frontend-check · backend-check · ai-check
```

Each app folder is **fully independent** — clone, `cd` in, install, run. There is no monorepo wrapper.

## Tech stack (locked)

| Layer       | Choice                                                                 |
|-------------|------------------------------------------------------------------------|
| Frontend    | Next.js 14 App Router, TypeScript, Tailwind, Zustand, TanStack Query   |
| Backend     | NestJS, Prisma, PostgreSQL 16, JWT (httpOnly cookies), Redis + BullMQ  |
| AI          | FastAPI, Claude vision/text, slowapi rate-limit                        |
| Search      | Meilisearch 1.10                                                       |
| Payments    | PhonePe (raw-body HMAC + idempotent webhooks)                          |
| Email       | Resend (with safe dev no-op fallback)                                  |
| Storage     | Cloudflare R2                                                          |

## Quick start

### 0. Local infra (Postgres + Redis + Meilisearch)

```bash
cp .env.docker .env             # one-time, edit POSTGRES_PASSWORD / MEILI_MASTER_KEY
docker compose up -d            # starts the three stateful services
docker compose ps               # confirm healthy
```

Ports bound to localhost only:
- Postgres: `127.0.0.1:5432`
- Redis: `127.0.0.1:6379`
- Meilisearch: `127.0.0.1:7700`

### 1. Backend (commerce API)

```bash
cd Backend
cp .env.example .env            # generate JWT secrets with: openssl rand -hex 64
npm install
npx prisma generate
npx prisma migrate deploy       # applies prisma/migrations/* against your DB
npm run prisma:seed             # idempotent seed of products / concerns / hero
npm run start:dev               # http://localhost:4000/api
npm test                        # node:test suites — 34/34 passing
```

### 2. Frontend (storefront)

```bash
cd Frontend
cp .env.example .env
npm install
npm run dev                     # http://localhost:3000
```

Ships with realistic mock data so the UI renders standalone even before the Backend is up.

### 3. AI Service

```bash
cd AI-Service
cp .env.example .env            # optional: add ANTHROPIC_API_KEY
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Without an Anthropic key, the recommender returns deterministic results so flows can be exercised offline.

## What's in the Backend

Beyond the obvious storefront modules (products, cart, orders, search), the API ships:

- **Hardened auth**: refresh-token rotation with reuse detection, email verification, password reset, account lockout, atomic `failedLoginAttempts` increment, audit trail (`AuthEvent`).
- **PhonePe**: raw-body HMAC verification (no JSON re-serialisation bug), server-side amount lookup, idempotent webhook handling persisted to `WebhookEvent`.
- **Coupons**: PERCENT / FLAT with min-cart, max-uses, per-user limit, category restriction, atomic redemption inside the order transaction.
- **Shipments**: courier + tracking with an immutable `ShipmentEvent` timeline; auto-rolls order status PAID → PROCESSING → SHIPPED → DELIVERED.
- **Inventory audit**: every stock change funnels through `InventoryService.adjust`, which writes an `InventoryMovement` row in the same transaction (CAS-style conditional update keeps stock ≥ 0).
- **Soft delete** on Product, User, Review, Category — historical orders survive product deletion; listings filter via `excludeDeleted` helper.
- **OrderItem snapshots**: `productNameSnapshot`, `productImageSnapshot`, `skuSnapshot` make past orders immutable.
- **Idempotency keys**: `Idempotency-Key` header on `POST /api/orders`; provider txn id on PhonePe payments.
- **Default-secure**: global `JwtAuthGuard` — every endpoint requires auth unless `@Public()`. Strict CORS, Helmet CSP/HSTS, per-endpoint throttling, structured request/security logging.

See [docs/SECURITY.md](docs/SECURITY.md) for the full threat model and control matrix.

## Tests

```bash
# Backend — pure unit suites (no DB needed)
cd Backend && npm test
# 34/34 across: coupon pricing, soft-delete helpers, password policy,
# token utilities, PhonePe signature verification.

# Frontend — typecheck + production build
cd Frontend && npm run typecheck && npm run build
```

Integration tests against the live Postgres service in CI will land as the
test suite grows. The CI pipeline ([.github/workflows/backend-check.yml](.github/workflows/backend-check.yml))
already boots Postgres and runs `prisma migrate deploy` end-to-end on every PR.

## CI

Three GitHub Actions workflows, path-filtered so a single-folder change doesn't trigger all of them:

| Workflow                                                | What it runs                                              |
|---------------------------------------------------------|-----------------------------------------------------------|
| [frontend-check](.github/workflows/frontend-check.yml)  | install · lint · typecheck · build                        |
| [backend-check](.github/workflows/backend-check.yml)    | install · prisma validate / generate / migrate · test · build |
| [ai-check](.github/workflows/ai-check.yml)              | install · ruff · smoke-import · pytest                    |

Each workflow `concurrency-cancels` superseded runs.

## Shared types

Frontend types live under [`Frontend/src/types/`](Frontend/src/types/). Backend uses Prisma-generated types from [`Backend/prisma/schema.prisma`](Backend/prisma/schema.prisma). Keep them aligned at the API boundary when shapes change.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — system design & build order
- [`docs/SECURITY.md`](docs/SECURITY.md) — threat model, controls, incident response
