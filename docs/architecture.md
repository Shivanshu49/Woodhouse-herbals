# Wood House Herbals — Architecture & Build Order

## 1. High-level architecture

```
┌──────────────────────┐    HTTPS    ┌────────────────────────┐
│   Frontend (Next 14) │────────────▶│   Backend (NestJS)     │
│  Storefront only     │             │  REST + Prisma + Redis │
└──────────┬───────────┘             └──────────┬─────────────┘
           │                                    │
           │ optional AI calls                  │ Prisma
           ▼                                    ▼
┌──────────────────────┐             ┌────────────────────────┐
│ AI-Service (FastAPI) │             │  PostgreSQL            │
│ Claude vision/text   │             │  Meilisearch / Redis   │
└──────────────────────┘             └────────────────────────┘
```

The admin panel is a **separate Next.js app** (`Admin/`, dev port 3001) that
consumes the same NestJS API via `/api/admin/*` endpoints — see
`docs/superpowers/specs/2026-07-03-admin-panel-design.md`.

## 2. Frontend

- **Framework**: Next.js 14 App Router + TypeScript
- **Styling**: Tailwind CSS with a custom herbal palette (deep forest green, warm cream, sand, sage)
- **State**: Zustand for cart/wishlist/UI, TanStack Query for server state
- **Image**: next/image with R2 origin
- **A11y**: focus rings, semantic landmarks, reduced motion respected

### Pages
- `/` — Homepage (offer strip, hero, bestsellers, shop-by-concern, new arrivals, combo packs, testimonials)
- `/shop` — Catalog with filters (skin type, hair concern, category, price, rating)
- `/shop/[slug]` — Product detail (gallery, ingredients, benefits, how-to-use, reviews, recs)
- `/concerns/[slug]` — Concern landing pages
- `/cart`, `/checkout` — Commerce flow
- `/account/*` — Orders, addresses, wishlist
- `/about`, `/career`, `/distributorship` — Brand pages
- `/ai/skin-analysis` — Optional AI flow

## 3. Backend

NestJS modules:
- `auth`       — JWT cookies, refresh rotation w/ reuse detection, email
                 verification, password reset, account lockout, `AuthEvent` log
- `products`   — listing + detail + soft-delete-aware filters
- `categories` — taxonomy (`Category`, `Concern`), both soft-deletable
- `cart`       — guest + user carts; cart claim on login
- `orders`     — atomic stock decrement + price revalidation + idempotency-key
                 replay protection; immutable `OrderItem` snapshots
- `customers`  — profile, addresses (with optional GSTIN), wishlist (real FK
                 to Product)
- `coupons`    — PERCENT / FLAT, min-cart, max-uses, per-user cap, category
                 restriction; atomic redeem inside the order tx
- `shipments`  — courier / tracking with `ShipmentEvent` timeline; auto-rolls
                 order status PAID → PROCESSING → SHIPPED → DELIVERED
- `inventory`  — single-funnel `adjust()` with `InventoryMovement` audit log
- `phonepe`    — raw-body HMAC, server-side amount, idempotent webhook
                 persisted to `WebhookEvent`
- `reviews`    — moderated, soft-deletable; `verifiedPurchase` derived
                 server-side from order history
- `search`     — Meilisearch (or Prisma `ILIKE` fallback)
- `homepage`   — single-payload composer for the storefront
- `common/security` — guards (Jwt, Roles), `AuthEvent` + `WebhookEvent`
                       writers, request-logging interceptor

Cross-cutting:
- Prisma + PostgreSQL 16; explicit `excludeDeleted` helper for the four
  soft-deletable models (Product, User, Review, Category).
- Redis + BullMQ for background jobs (emails, search reindex, low-stock alerts).
- Resend for transactional email (dev no-op).
- Meilisearch for autocomplete + faceted search.
- Cloudflare R2 for assets — presigned-PUT endpoint planned, env wired.

Cross-cutting safety:
- Boot-time Zod env validation rejects placeholder secrets in production.
- Helmet CSP/HSTS, strict CORS allow-list, 256 KB body cap.
- Per-endpoint throttling (`@Throttle`) layered on top of a 120 req/min
  global default.
- Structured request log emits a single JSON line per request; 401/403/429/5xx
  escalate to warn/error.
- All money in minor units (paise); `Currency` enum on Product/Order/Payment.

## 4. AI service

FastAPI with:
- `/health` — readiness probe
- `/v1/skin-analysis` — accepts user concerns + optional image, returns ranked product slugs and rationale
- `/v1/search-rank` — re-rank search candidates using semantic similarity (future)

Keeps the AI layer **optional** — the storefront and API run fully without it.

## 5. Build order

1. Flat folder layout: `Frontend/`, `Backend/`, `AI-Service/` ✅
2. Storefront UI shell + design system ✅
3. Homepage + shop + product detail with mock data ✅
4. NestJS scaffolding with Prisma schema + REST endpoints ✅
5. FastAPI AI scaffold ✅
6. Stitch-driven design system tokens locked into Tailwind config
7. Wire storefront to API (env-flagged, mock fallback retained)
8. Auth flow end-to-end (JWT cookies, refresh rotation, email verification)
9. Cart + checkout flow against backend (Zustand → REST)
10. PhonePe checkout integration (sandbox → callback → webhook → order paid)
11. Skin/hair quiz (decision tree first, no AI)
12. AI skin analysis endpoint (Claude vision + instructor + image preprocessing)
13. Quiz/AI results → product recommendations matched against catalog
14. Admin panel — separate `Admin/` Next.js app + `/api/admin/*` endpoints
    (spec: docs/superpowers/specs/2026-07-03-admin-panel-design.md) — IN PROGRESS
15. Meilisearch integration for product search/autocomplete
16. Transactional email via Resend (order confirmation, OTP, password reset)
17. Production deployment — real PhonePe credentials, custom domain, env wiring
18. Polish pass — accessibility, performance budgets, mobile QA, Lighthouse > 90

## 6. Brand tokens

```
Deep forest green   #1F3A2E   primary action, headings on light
Warm cream          #FAF6EE   page background
Sand                #E9DEC9   surfaces, dividers
Sage                #C9D5C0   accents, badges
Terracotta          #C97A55   sale / hot accents
Charcoal            #1E1B17   body text on light
```

Typography: serif display (Fraunces/Playfair) for headings, sans (Inter) for body.
