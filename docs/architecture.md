# Wood House Herbals — Architecture & Build Order

## 1. High-level architecture

```
┌──────────────────────┐    HTTPS    ┌────────────────────────┐
│   Frontend (Next 14) │────────────▶│   Backend (NestJS)     │
│  Storefront + Admin  │             │  REST + Prisma + Redis │
└──────────┬───────────┘             └──────────┬─────────────┘
           │                                    │
           │ optional AI calls                  │ Prisma
           ▼                                    ▼
┌──────────────────────┐             ┌────────────────────────┐
│ AI-Service (FastAPI) │             │  PostgreSQL            │
│ Claude vision/text   │             │  Meilisearch / Redis   │
└──────────────────────┘             └────────────────────────┘
```

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
6. Security hardening (auth races, IDOR, secrets, CSP/HSTS, throttling) ✅
7. PhonePe payment flow (raw-body HMAC, server-side amount, idempotent
   webhook persisted to WebhookEvent) ✅
8. Schema overhaul: coupons, shipments, inventory audit, soft delete,
   OrderItem snapshots, idempotency keys ✅
9. Service-layer wiring for coupons / shipments / inventory audit ✅
10. docker-compose local infra + GitHub Actions CI for all three services ✅
11. Wire storefront to API (env-flagged) — TODO
12. R2 presigned-upload endpoint for admin product images — TODO
13. Meilisearch index sync + replace Prisma ILIKE search — TODO
14. Admin UI for coupon / shipment / order management — TODO
15. Frontend AI flow end-to-end against `/v1/skin-analysis` — TODO

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
