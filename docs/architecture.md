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
- `auth` — JWT (httpOnly cookies), register/login/refresh, password reset
- `products` — listing, detail, filters, search
- `categories` — categories & concerns taxonomy
- `cart` — guest + user carts
- `orders` — order lifecycle, status transitions
- `customers` — profile, addresses, wishlist
- `phonepe` — checkout init, webhook, verification
- `inventory` — stock & low-stock alerts
- `reviews` — moderated reviews
- `common/admin` — admin-only endpoints, RBAC guard

Cross-cutting:
- Prisma + PostgreSQL
- Redis + BullMQ for background jobs (emails, search reindex, low-stock alerts)
- Resend for transactional email
- Meilisearch for search/autocomplete
- Cloudflare R2 for assets

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
6. Wire storefront to API (env-flagged)
7. PhonePe checkout flow
8. Admin endpoints
9. Search (Meilisearch) integration
10. AI skin/hair flow

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
