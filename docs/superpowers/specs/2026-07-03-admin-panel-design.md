# Wood House Herbals — Admin Panel Design

Date: 2026-07-03
Status: Approved design, pending implementation plan

## 1. Context and goals

The store owner (non-technical) needs a complete admin panel to manage the
store: products, orders, categories, customers, coupons, inventory, reviews,
homepage content, marketing, analytics, shipping, and settings. It must be
clean, professional, and usable on desktop and tablet.

The repo is a flat multi-app monorepo (no workspace tooling):

- `Backend/` — NestJS + Prisma → Neon Postgres. Owns the schema and all
  commerce invariants (atomic inventory CAS, coupon redemption, order state
  machine, PhonePe HMAC payments, hardened auth with refresh rotation).
- `Frontend/` — Next.js 14.2.5 storefront (custom brand components, partially
  wired to the API).
- `AI-Service/` — FastAPI recommender (not involved here).

The backend already models roughly half of the admin spec (products with
images/ingredients/badges/concerns, categories, orders with all six required
statuses, coupons with limits and category scoping, reviews with approval,
shipments with event timelines, inventory movements with actor attribution,
hero banners, offer strip) and already has admin-guarded endpoints for
coupons, shipments, and review approval. `docs/architecture.md` step 14
planned this work ("Admin endpoints + admin UI").

## 2. Decisions (settled with the owner, 2026-07-03)

1. **Architecture**: the admin panel is a client of the NestJS API. No
   second Prisma client, no NextAuth, no server actions for mutations — the
   backend stays the single owner of the schema and business logic. We extend
   it with `/api/admin/*` endpoints.
2. **Location**: a new, separate `Admin/` Next.js 14 app alongside
   `Backend/` and `Frontend/` (not routes inside the storefront).
   `docs/architecture.md` line 8 ("Storefront + Admin" in one app) is
   superseded and must be updated.
3. **Images**: Cloudinary, via a signed-upload endpoint in NestJS (browser
   uploads directly to Cloudinary; API secret never leaves the server). The
   dormant R2 env vars stay dormant.
4. **Payments**: PhonePe stays the gateway. Settings shows PhonePe
   configuration; refunds use PhonePe's refund API. Razorpay is out of scope.

## 3. Architecture overview

```
┌─────────────────┐      ┌──────────────────────┐
│ Admin/ (NEW)    │─────▶│ Backend/ NestJS API  │────▶ Neon Postgres
│ Next.js 14      │ REST │  + /api/admin/*      │
│ shadcn/ui       │cookie│  + uploads/sign      │────▶ Cloudinary (signed)
└─────────────────┘ auth │  + auth (existing)   │────▶ PhonePe (pay+refund)
┌─────────────────┐      │                      │────▶ Resend (mail)
│ Frontend/ store │─────▶│                      │
└─────────────────┘      └──────────────────────┘
```

- Dev ports: backend **4000**, storefront **3000**, admin **3001**.
- Prod hosting constraint: auth cookies are `SameSite=strict`, host-only.
  The admin app MUST be same-site with the API —
  `admin.woodhouseherbals.com` next to `api.woodhouseherbals.com`. A bare
  `*.vercel.app` admin cannot hold a session against the production API.
- CORS: append the admin origin to the backend's comma-separated
  `WEB_ORIGIN` env (`http://localhost:3001` in dev). Storefront origin stays
  first in the list (index 0 feeds customer email links).

## 4. Phasing

Each phase lands independently with `typecheck` + `build` + `test` green.

| Phase | Contents |
|---|---|
| **A — Foundations** | Full Prisma migration set (§5), `MANAGER` role, `npm run admin:create` seed script, `POST /auth/admin-login`, `JWT_ADMIN_REFRESH_TTL` + `ADMIN_ORIGIN` envs, Cloudinary uploads module, `AdminAuditLog` interceptor, shared `PaginationDto`, `WEB_ORIGIN` update |
| **B — Admin shell** | Scaffold `Admin/`, shadcn/ui + dark mode, login page, auth guard, 30-min idle timeout, sidebar/topbar/breadcrumbs/toasts/Cmd+K palette, stub pages with empty states for all 13 sections, `admin-check` CI job |
| **C — Dashboard** | `admin-dashboard` module (stats, revenue series, recent orders, top products) + dashboard UI (Recharts) |
| **D — Products** | `admin-products` + `admin-categories`(+concerns) API: CRUD, variants, duplicate, bulk, CSV export/import, slug check; products list (TanStack Table) + tabbed add/edit form |
| **E — Orders** | `admin-orders` API: list, detail, validated status transitions, notes, tracking, PhonePe refund, invoice data; orders list + detail UI with timeline and PDF invoice |
| **F — Categories + Settings UI** | Category manager (tree, drag-reorder, SEO); `admin-settings` API over `StoreSetting` + Settings UI (store info, payments/COD toggles, integrations status, Users & Roles) |

**Later phases (own spec each; schema already migrated in Phase A):**
Customers, Coupons UI (+ PATCH/stats endpoints), Inventory page, Reviews,
Content (homepage manager, testimonials, FAQs, static pages), Analytics,
Marketing (campaigns via Resend/BullMQ), Shipping (zones/Shiprocket). Their
sidebar entries exist from Phase B with designed empty states.

**Explicitly deferred:** storefront variant-aware cart/checkout; per-line GST
math at checkout (see §5.1); traffic-source chart (needs GA4); Shiprocket;
WhatsApp/SMS campaigns; database backup UI.

## 5. Data model changes (one migration set in Phase A)

Conventions (must match existing schema): `String @id @default(cuid())`,
money as `Int` paise with `Minor` suffix, `deletedAt` soft delete +
`@@index([deletedAt])`, explicit FK pairs with `Cascade` (owned children) /
`SetNull` (actor attribution), join tables named `<A><B>` with composite
`@@id`, additive-only enum evolution, `sortOrder`/`active`/`startsAt`/`endsAt`
for content models, `@db.Text` for long text.

Backward compatibility guarantees for the storefront (which keeps working
untouched): keep `Product.inStock` (synced from stock changes), keep
`Review.approved` (synced from new `status`), keep `Product.category` enum +
`categoryRefId` (link rows backfilled from them), `ProductStatus` defaults to
`PUBLISHED` so existing rows stay live.

### 5.1 Product — new fields

```prisma
enum ProductStatus { DRAFT PUBLISHED SCHEDULED }
enum StockStatus   { IN_STOCK OUT_OF_STOCK BACKORDER }
enum GstRate       { EXEMPT GST_5 GST_12 GST_18 GST_28 }

// added to model Product:
barcode           String?       @unique
brand             String        @default("Wood House Herbals")
videoUrl          String?
costPriceMinor    Int?
gstRate           GstRate       @default(GST_18)
hsnCode           String?
saleStartsAt      DateTime?
saleEndsAt        DateTime?
lowStockThreshold Int           @default(5)
allowBackorder    Boolean       @default(false)
trackInventory    Boolean       @default(true)
stockStatus       StockStatus   @default(IN_STOCK)
tags              String[]
inciText          String?       @db.Text
parabenFree       Boolean       @default(false)
sulfateFree       Boolean       @default(false)
crueltyFree       Boolean       @default(false)
vegan             Boolean       @default(false)
alcoholFree       Boolean       @default(false)
usageFrequency    String?
recommendedTime   String?       // "morning" | "night" | "both" | "anytime"
metaTitle         String?
metaDescription   String?
focusKeyword      String?
ogImageUrl        String?
weightGrams       Int?
lengthCm          Float?
widthCm           Float?
heightCm          Float?
shippingClass     String?
freeShipping      Boolean       @default(false)
status            ProductStatus @default(PUBLISHED)
publishAt         DateTime?
featured          Boolean       @default(false)
// + @@index([status])
```

Pricing reuses the existing pair: `priceMinor` = current sell price,
`compareAtPriceMinor` = struck-through regular price. Admin form labels:
"Regular price" writes `compareAtPriceMinor` (or `priceMinor` when no sale),
"Sale price" writes `priceMinor`. No third price column.

GST note: `gstRate`/`hsnCode` are stored per product and printed on invoice
line items. Checkout totals keep using `computeOrderTotals` with the
order-level `GST_RATE_PERCENT` env for now; per-line GST at checkout is a
deferred, separate change (touches order placement math).

`benefits String[]` is superseded by the `ProductBenefit` model (migration
copies existing entries into rows; the column is kept until the storefront
reads the new relation, then dropped in a later cleanup migration).

### 5.2 New models

```prisma
model ProductVariant {
  id                  String    @id @default(cuid())
  product             Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  productId           String
  name                String    // "15 g", "30 g", "100 ml"
  sku                 String    @unique
  barcode             String?
  priceMinor          Int
  compareAtPriceMinor Int?
  costPriceMinor      Int?
  stockQty            Int       @default(0)
  lowStockThreshold   Int       @default(5)
  imageUrl            String?
  attributes          Json?     // { "size": "15g", "scent": "lavender", ... }
  isDefault           Boolean   @default(false)
  sortOrder           Int       @default(0)
  deletedAt           DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@index([productId])
  @@index([deletedAt])
}

model ProductBenefit {
  id        String  @id @default(cuid())
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  productId String
  text      String
  iconUrl   String?
  sortOrder Int     @default(0)
}

model ProductCategoryLink {
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  productId  String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  categoryId String
  isPrimary  Boolean  @default(false)

  @@id([productId, categoryId])
}

model OrderNote {
  id                String   @id @default(cuid())
  order             Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderId           String
  author            User?    @relation(fields: [authorId], references: [id], onDelete: SetNull)
  authorId          String?
  body              String   @db.Text
  isCustomerVisible Boolean  @default(false)
  createdAt         DateTime @default(now())

  @@index([orderId, createdAt])
}

model OrderEvent {
  id         String       @id @default(cuid())
  order      Order        @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderId    String
  type       String       // "status_changed" | "note_added" | "refund_issued" | ...
  fromStatus OrderStatus?
  toStatus   OrderStatus?
  actor      User?        @relation(fields: [actorId], references: [id], onDelete: SetNull)
  actorId    String?
  note       String?
  meta       Json?
  createdAt  DateTime     @default(now())

  @@index([orderId, createdAt])
}

enum RefundStatus { PENDING PROCESSED FAILED }

model Refund {
  id               String       @id @default(cuid())
  order            Order        @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderId          String
  payment          Payment?     @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  paymentId        String?
  amountMinor      Int
  currency         Currency     @default(INR)
  reason           String?
  status           RefundStatus @default(PENDING)
  providerRefundId String?      @unique
  rawResponse      Json?
  actor            User?        @relation(fields: [actorId], references: [id], onDelete: SetNull)
  actorId          String?
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  @@index([orderId])
  @@index([status, createdAt])
}

model CouponProduct {
  coupon    Coupon  @relation(fields: [couponId], references: [id], onDelete: Cascade)
  couponId  String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  productId String
  excluded  Boolean @default(false) // false = in scope; true = explicitly excluded

  @@id([couponId, productId])
}

model CouponUser {
  coupon   Coupon @relation(fields: [couponId], references: [id], onDelete: Cascade)
  couponId String
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId   String

  @@id([couponId, userId])
}

model Testimonial {
  id         String   @id @default(cuid())
  authorName String
  authorMeta String?  // "Verified buyer · Mumbai"
  avatarUrl  String?
  rating     Int?
  body       String   @db.Text
  active     Boolean  @default(true)
  sortOrder  Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Faq {
  id        String   @id @default(cuid())
  question  String
  answer    String   @db.Text
  category  String?
  sortOrder Int      @default(0)
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model StaticPage {
  id              String   @id @default(cuid())
  slug            String   @unique // "about", "privacy-policy", "terms", ...
  title           String
  bodyHtml        String   @db.Text
  metaTitle       String?
  metaDescription String?
  published       Boolean  @default(true)
  updatedBy       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum HomepageSection { FEATURED NEW_ARRIVALS BEST_SELLERS COMBO_PACKS }

model HomepageSelection {
  id        String          @id @default(cuid())
  section   HomepageSection
  product   Product         @relation(fields: [productId], references: [id], onDelete: Cascade)
  productId String
  sortOrder Int             @default(0)
  createdAt DateTime        @default(now())

  @@unique([section, productId])
  @@index([section, sortOrder])
}

model StoreSetting {
  id        String   @id @default(cuid())
  key       String   @unique // "store.name", "store.gstin", "shipping.freeAboveMinor", ...
  value     Json
  updatedBy String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model AdminAuditLog {
  id         String   @id @default(cuid())
  actor      User?    @relation(fields: [actorId], references: [id], onDelete: SetNull)
  actorId    String?
  action     String   // "product.update", "order.status_change", ...
  entityType String   // "Product" | "Order" | "Coupon" | ...
  entityId   String?
  before     Json?
  after      Json?
  ip         String?
  userAgent  String?
  createdAt  DateTime @default(now())

  @@index([actorId, createdAt])
  @@index([entityType, entityId])
  @@index([createdAt])
}
```

### 5.3 Modified models and enums

- `UserRole`: add `MANAGER` (additive `ALTER TYPE ... ADD VALUE`; must be its
  own migration file, not bundled with data backfills). `CUSTOMER` stays the
  default.
- `User`: add `adminNote String? @db.Text`, `marketingConsent Boolean
  @default(false)`, `marketingConsentAt DateTime?`.
- `Category`: add `description String? @db.Text`, `metaTitle`,
  `metaDescription`, self-relation tree (`parentId String?` +
  `parent/children @relation("CategoryTree")`, `onDelete: SetNull`,
  `@@index([parentId])`). Make `Category.category ProductCategory` **optional**
  so free-form categories can be created.
- `Review`: add `enum ReviewStatus { PENDING APPROVED REJECTED }`, `status
  ReviewStatus @default(PENDING)` (backfill: approved=true → APPROVED, else
  PENDING), `adminReply String? @db.Text`, `adminReplyAt DateTime?`,
  `adminReplyBy String?`, `flagged Boolean @default(false)`, `flagReason
  String?`, `flaggedAt DateTime?`. Add `@@index([productId, status])`; keep
  `approved` synced until the storefront reads `status`.
- `Coupon`: add enum values `FREE_SHIPPING`, `BXGY` to `CouponKind`; add
  `buyQty Int?`, `getQty Int?`, `enum CouponEligibility { ALL FIRST_TIME
  SPECIFIC }` + `eligibility CouponEligibility @default(ALL)`.
- `Recommendation`: add `enum RecommendationKind { RELATED
  FREQUENTLY_BOUGHT_TOGETHER CROSS_SELL }` + `kind RecommendationKind
  @default(RELATED)`; unique becomes `@@unique([sourceProductId,
  targetProductId, kind])`.
- `HeroBanner`: add `sortOrder Int @default(0)`.
- `OfferStripItem`: add `startsAt DateTime?`, `endsAt DateTime?`,
  `createdAt`/`updatedAt` (only model missing timestamps).
- `Concern`: add `active Boolean @default(true)`.
- `PaymentStatus`: add `PARTIALLY_REFUNDED` (additive).
- Variant plumbing: optional `variantId` (+ relation, `SetNull`) on
  `CartLine`, `OrderItem` (+ `variantNameSnapshot String?`), and
  `InventoryMovement`. `CartLine` unique becomes `@@unique([cartId,
  productId, variantId])`.

### 5.4 Settings keys seeded in Phase A

`store.name`, `store.tagline`, `store.logoUrl`, `store.faviconUrl`,
`store.contactEmail`, `store.contactPhone`, `store.address`, `store.gstin`,
`store.pan`, `store.socialLinks`, `shipping.freeAboveMinor` (49900 — replaces
the constant duplicated in `cart.service.ts:95` and `orders.service.ts:119`;
both read the setting with 49900 fallback), `inventory.defaultLowStockThreshold`
(5), `payments.codEnabled` (false), `notifications.adminEmail`.
Integration secrets (PhonePe, Cloudinary, Resend, MSG91) stay env-only;
Settings exposes masked `configured: true/false` status, never values.

## 6. Backend admin API

New modules under `Backend/src/modules/admin/` following the existing
module trio convention (`*.module.ts`, `*.controller.ts`, `*.service.ts`,
`dto/*.dto.ts`, pure logic extracted to `*-<topic>.ts` with colocated
`*.test.ts`). All controllers: `@Controller('admin/...')` (global `api`
prefix applies), class-level `@Roles(...)` with stricter method-level
overrides. All list endpoints use a shared `PaginationDto` and return
`{ items, total, page, perPage }` (the `ListProductsDto` convention).
Class-validator DTOs under the global strict ValidationPipe (whitelist +
forbidNonWhitelisted); enums imported from `@prisma/client`; money fields
`*Minor` with `@IsInt() @Min(0)`.

### 6.1 Role matrix

| Capability | ADMIN | MANAGER | STAFF |
|---|---|---|---|
| Dashboard, all read views | ✔ | ✔ | ✔ |
| Products/categories/content CRUD, CSV | ✔ | ✔ | — |
| Orders: status, tracking, notes | ✔ | ✔ | ✔ |
| Inventory adjust | ✔ | ✔ | ✔ |
| Reviews moderation + reply | ✔ | ✔ | ✔ |
| Coupons CRUD | ✔ | ✔ | — |
| Refunds | ✔ | — | — |
| Settings (store info, payments) | ✔ | — | — |
| Users & roles management | ✔ | — | — |

### 6.2 Endpoints

**admin-dashboard** (`GET`, ADMIN+MANAGER+STAFF)
- `/admin/dashboard/stats` — today's sales (sum `totalMinor` where status in
  PAID/PROCESSING/SHIPPED/DELIVERED and `placedAt >= startOfDay`, IST),
  today's order count, pending count (PENDING+PAID), low-stock count,
  new customers (7 days), revenue this month. Uses existing
  `@@index([status, placedAt])`.
- `/admin/dashboard/revenue-series?days=30` — raw SQL `date_trunc` groupBy →
  `[{ date, revenueMinor, orders }]`.
- `/admin/dashboard/recent-orders?limit=10` — thin projection.
- `/admin/dashboard/top-products?days=7` — `orderItem.groupBy` by productId
  with quantity/revenue sums, names from snapshots.

**admin-products** (ADMIN+MANAGER; reads also STAFF)
- `GET /admin/products` — q (name/SKU), status, category, stock level, price
  range, sort (newest/price/stock/sales), paginated; includes drafts and
  soft-deleted (explicit `deleted=true` filter).
- `GET /admin/products/:id` — by id, all relations, includes deleted.
- `POST /admin/products` — nested create (images, variants, benefits,
  ingredients, badges, concerns, category links, recommendations). Slug/SKU
  uniqueness → 409.
- `PATCH /admin/products/:id` — must NOT accept `stockQty` (only
  `InventoryService.adjust` touches stock), nor `rating`/`reviewCount`
  (owned by review recompute). Variant stock likewise adjust-only.
- `DELETE /admin/products/:id` — soft delete; `POST .../restore`.
- `POST /admin/products/:id/duplicate` — copy + relations, suffixed
  slug/SKU, zero stock, `DRAFT`.
- `POST /admin/products/bulk` — `{ ids, action: publish|draft|archive|
  restore|set-category|delete }`, one transaction.
- `GET /admin/products/export.csv` — streamed CSV.
- `POST /admin/products/import` — multipart (dodges 256 KB JSON cap); stock
  columns route through `InventoryService.adjust(reason: RECONCILIATION)`.
- `GET /admin/products/slug-check?slug=&excludeId=`.

**admin-categories** (ADMIN+MANAGER)
- `GET/POST /admin/categories`, `PATCH/DELETE /admin/categories/:id` (soft
  delete; block delete when products link to it, offer re-assign), `POST
  /admin/categories/reorder` (batch sortOrder + parent moves, one tx).
- Same trio for concerns (`/admin/concerns`).
- Fix: public `CategoriesService.list` gains `excludeDeleted` (it currently
  leaks soft-deleted rows).

**admin-orders** (ADMIN+MANAGER+STAFF; refund ADMIN-only)
- `GET /admin/orders` — status, payment status, date range, q
  (number/name/phone), paginated.
- `GET /admin/orders/:number` — routes existing
  `OrdersService.adminFindByNumber` (fixing its ForbiddenException →
  NotFoundException); includes items, payments, shipments+events,
  redemptions, notes, events, refunds, user.
- `POST /admin/orders/:number/status` — validated transition map (pure
  function + test): PENDING→{PAID, CANCELLED} (PENDING→PAID is a manual
  "mark as paid" for offline reconciliation, ADMIN-only, always recorded
  with a note), PAID→{PROCESSING, CANCELLED}, PROCESSING→{SHIPPED,
  CANCELLED}, SHIPPED→{DELIVERED}, terminal DELIVERED/CANCELLED/REFUNDED
  (REFUNDED is reachable only via the refund endpoint, never set directly). SHIPPED/DELIVERED delegate to
  `ShipmentsService`; CANCELLED restores stock via
  `InventoryService.adjust(reason: ORDER_CANCELLED)` in the same tx
  (mirroring `PhonepeService.markFailed`). Every change writes `OrderEvent`.
- `POST /admin/orders/:number/tracking` — delegates to existing
  `ShipmentsService.create`.
- `GET/POST /admin/orders/:number/notes` — internal or customer-visible.
- `POST /admin/orders/:number/refund` — ADMIN. New
  `PhonepeService.refund()`: CAS-guard payment SUCCESS, call PhonePe refund
  API, write `Refund` row, set payment REFUNDED (or PARTIALLY_REFUNDED) +
  order REFUNDED, optional stock restore (`reason: RETURNED`), record via
  `WebhookEventsService` for the refund callback.
- `GET /admin/orders/:number/invoice` — invoice payload from money + address
  snapshots, `computeOrderTotals` GST split, per-line `gstRate`/`hsnCode`,
  `shippingGstin`. (PDF is rendered client-side.)

**admin-inventory** (ADMIN+MANAGER+STAFF)
- `GET /admin/inventory` — stock list, `lowStock=true` filter (per-product
  threshold), paginated.
- `POST /admin/inventory/:productId/adjust` — `{ delta, reason:
  MANUAL_ADJUSTMENT|RESTOCK|DAMAGED|RETURNED|RECONCILIATION, note?,
  variantId? }`; calls `InventoryService.adjust` with `actorId`; adjust is
  extended to accept `note` and sync `inStock`/`stockStatus` on zero
  crossings; ConflictException surfaces as a retry prompt in the UI.
- `GET /admin/inventory/:productId/movements` — paginated history + actor
  names (existing `historyForProduct`, canonical reasons merged with
  deprecated synonyms for display).

**admin-reviews** (ADMIN+MANAGER+STAFF) — extends existing module
- `GET /admin/reviews` — status/rating/product filters, paginated
  (supersedes unpaginated `/reviews/pending`).
- `POST /admin/reviews/:id/reject` — sets `status: REJECTED`; recomputes
  product rating in the same tx if previously approved
  (`recomputeProductRating` made internal-public).
- `POST /admin/reviews/:id/reply`, `POST /admin/reviews/:id/flag`.
- Existing approve endpoint updated to write `status` + keep `approved`
  synced.

**admin-customers** (ADMIN+MANAGER) — entire module (endpoints + UI) lands
with the later Customers phase; only the schema fields ship in Phase A.

**admin-content** (ADMIN+MANAGER) — entire module (endpoints + UI) lands
with the later Content phase; models ship in Phase A.
- Hero banners, offer strip, testimonials, FAQs, static pages,
  homepage selections: standard CRUD + reorder.

**admin-settings** (ADMIN)
- `GET /admin/settings` — all keys + masked integration statuses.
- `PUT /admin/settings` — upsert whitelisted keys only; secrets rejected.

**admin-users** (ADMIN)
- `GET /admin/users` — STAFF/MANAGER/ADMIN accounts.
- `POST /admin/users` — create with role; invite via existing
  password-reset machinery (user created `passwordHash: null`,
  `emailVerified: true`, then `requestPasswordReset` fires with admin URL).
- `PATCH /admin/users/:id` — role change, deactivate (soft delete),
  unlock (`failedLoginAttempts`/`lockedUntil` reset), force-logout
  (revoke refresh families).

**uploads** (ADMIN+MANAGER)
- `POST /admin/uploads/sign` — Cloudinary signature (timestamp, folder,
  eager transforms); env additions `CLOUDINARY_CLOUD_NAME`,
  `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (zod, optional in dev with
  boot warning like Resend).

**coupons** (existing module; UI later) — `PATCH /admin/coupons/:id`
(never `usedCount`), `GET /admin/coupons/:id/stats` (aggregate
`CouponRedemption`).

### 6.3 Cross-cutting backend rules

- Every admin mutation writes `AdminAuditLog` via an interceptor on admin
  controllers (action derived from controller+handler, entity id from
  params, before/after snapshots supplied by services where cheap).
- Admin routes get `@Throttle` overrides where the global 120/min would
  pinch (dashboard widget fan-out, bulk operations).
- Soft-deletable models: admin lists pass explicit deleted-visibility;
  destructive endpoints are soft deletes with restore counterparts.
- No new exception filters; NestJS built-in exceptions keep the existing
  error shape. Conflict (409) for slug/SKU/stock races.

## 7. Auth design

Reuses the existing stack (bcrypt-12 + lockout + 15-min access JWT in
`wh_at` + rotating 30-day refresh in `wh_rt`, family reuse detection, global
JwtAuthGuard/RolesGuard). No NextAuth. Additions:

1. `POST /auth/admin-login` — thin wrapper over `AuthService.login` that
   rejects `role === CUSTOMER` **before** setting cookies (customer
   credentials never get admin-origin cookies). Same throttles.
2. `JWT_ADMIN_REFRESH_TTL` env (default 3600 s): `issueTokens` uses it when
   `role !== CUSTOMER`. Active use keeps rotating (sliding window); an idle
   admin session hard-expires server-side within the hour.
3. **30-min inactivity timeout (client)**: idle timer (pointer/keyboard/
   visibility events). While active, silent `POST /auth/refresh` via a
   401→refresh→retry-once fetch interceptor. At 30 min idle: stop
   refreshing, `POST /auth/logout` (revokes family), redirect to `/login`.
4. **Password reset**: reuse forgot/reset endpoints; `ADMIN_ORIGIN` env —
   reset URL base chosen by the user's role (admins get
   `${ADMIN_ORIGIN}/reset`, customers keep the storefront URL). Admin app
   ships `/login`, `/forgot`, `/reset` pages.
5. **Provisioning**: `Backend/prisma/seed-admin.ts` (`npm run admin:create`)
   — idempotent upsert from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env, strength-
   validated, `role: ADMIN`, `emailVerified: true` (login 403s otherwise).
   No credentials in the repo.
6. **CSRF**: unchanged posture (SameSite=strict + CORS allow-list + JSON-only
   bodies). Holds because the admin is same-site. Never relax to
   `SameSite=None`.

## 8. Admin app (`Admin/`)

Toolchain pinned to the repo's: `next@14.2.5` (exact), React 18.3, TS 5.5
strict, Tailwind 3.4, Node 20 (`engines` + `.nvmrc`), npm with own lockfile,
`@/*` alias, `dev: next dev -p 3001`, scripts `dev/build/start/lint/typecheck`.

Libraries: shadcn/ui (fresh default HSL theme + `tailwindcss-animate`,
deliberately NOT the storefront palette), `next-themes` (dark mode),
`@tanstack/react-query` 5, `@tanstack/react-table` 8, `react-hook-form` +
`zod` + `@hookform/resolvers`, `recharts`, `lucide-react`, `sonner`,
`react-day-picker`, Tiptap (rich text), `xlsx` (SheetJS, CSV/Excel),
`@react-pdf/renderer` (invoices), `cmdk` via shadcn Command (Cmd+K).

### 8.1 Structure

```
Admin/
├─ package.json  .nvmrc  next.config.mjs  tailwind.config.ts  components.json
└─ src/
   ├─ middleware.ts                  # cookie-presence redirect → /login
   ├─ app/
   │  ├─ layout.tsx  providers.tsx   # QueryClient, ThemeProvider, Sonner
   │  ├─ login/page.tsx  forgot/page.tsx  reset/page.tsx
   │  └─ (dashboard)/
   │     ├─ layout.tsx               # auth verify (/auth/me, role gate),
   │     │                           # sidebar + topbar + breadcrumbs + idle timer
   │     ├─ page.tsx                 # 1. Dashboard
   │     ├─ products/page.tsx        # 2. list
   │     │  ├─ new/page.tsx          #    create (tabbed form)
   │     │  └─ [id]/edit/page.tsx    #    edit (same form)
   │     ├─ categories/page.tsx      # 3.
   │     ├─ orders/page.tsx          # 4. list
   │     │  └─ [number]/page.tsx     #    detail
   │     ├─ customers/page.tsx       # 5. (stub → later phase)
   │     ├─ coupons/page.tsx         # 6. (stub)
   │     ├─ inventory/page.tsx       # 7. (stub)
   │     ├─ reviews/page.tsx         # 8. (stub)
   │     ├─ content/page.tsx         # 9. (stub)
   │     ├─ marketing/page.tsx       # 10. (stub)
   │     ├─ analytics/page.tsx       # 11. (stub)
   │     ├─ shipping/page.tsx        # 12. (stub)
   │     └─ settings/page.tsx        # 13. store info, payments, users, integrations
   ├─ components/
   │  ├─ ui/                         # shadcn generated
   │  ├─ layout/                     # sidebar, topbar, breadcrumbs, command-palette
   │  ├─ data-table/                 # generic TanStack wrapper: server pagination,
   │  │                              # sort, filters, bulk-select, empty/skeleton states
   │  ├─ forms/                      # money-input (₹↔paise), slug-input,
   │  │                              # image-upload (Cloudinary + progress),
   │  │                              # rich-text (Tiptap), confirm-dialog
   │  └─ products/ orders/ dashboard/ settings/   # feature components
   ├─ hooks/    use-auth.ts  use-idle-timeout.ts  use-debounce.ts
   ├─ lib/      api.ts  env.ts  cn.ts  money.ts  query-keys.ts
   └─ types/    api.ts  admin.ts
```

### 8.2 Patterns

- **API client** (`lib/api.ts`): storefront's typed fetch-wrapper pattern
  (`credentials: 'include'`, `ApiError` with status + Nest message join,
  base `${NEXT_PUBLIC_API_URL}/api`) — WITHOUT `withFallback` (admin must
  surface failures, never mask with mocks) — PLUS the 401→refresh→retry-once
  interceptor (skipped for `/auth/*` calls).
- **Env** (`lib/env.ts`): storefront's frozen literal-access pattern;
  `NEXT_PUBLIC_API_URL` → `http://localhost:4000` fallback.
- **Auth state**: React Query over `GET /auth/me`; login page posts to
  `/auth/admin-login`; dashboard layout ejects non-staff roles.
- **Mutations**: React Query mutations → invalidate queries; optimistic
  updates for cheap toggles (status, featured, active), pessimistic for
  money/stock. Sonner toast on success/error; destructive actions gated by
  confirm-dialog. All lists have skeleton + designed empty states.
- **Shortcuts**: Cmd+K command palette (navigate, search products/orders),
  Cmd+N new product on the products list.
- **Product form**: single RHF+Zod schema, tabs = General / Media / Pricing /
  Inventory / Variants / Organization / Ingredients / Usage & Benefits /
  SEO / Shipping / Related / Status. Slug auto-from-name (editable, async
  uniqueness check), ₹ inputs converting to paise at the edge, gallery with
  drag-reorder + per-image alt, sale-schedule and publish-schedule date
  pickers, per-tab error badges, sticky Save Draft / Publish / Preview bar.
- **Responsive**: sidebar collapses to sheet under `lg`; tables gain
  horizontal scroll containers; forms stack single-column on tablet.

## 9. Testing

- **Backend** (node:test, colocated `*.test.ts`, discovered by the find-based
  `npm test`): pure-function tests for the order transition map, dashboard
  date-window math (IST), CSV row mapping, coupon eligibility, refund
  amount guards, settings key whitelist, Cloudinary signature. Services keep
  the `{} as never` stub style; no Prisma mocking (extract logic instead).
- **Gates per phase**: Backend `npm run typecheck && npm run build && npm
  test` (40 existing tests stay green); Admin `npm run typecheck && npm run
  build`. Backend lint/format scripts are known-broken (no eslint/prettier
  installed) — not gates; match de-facto style.
- **Manual E2E per phase** via the running apps (seeded admin user, real
  Neon dev DB): login, create product, place storefront order, move it
  through statuses.

## 10. CI / deployment

- CI: add `admin-check` job to `.github/workflows/ci.yml`, cloned from
  `frontend-check` (`working-directory: Admin`, Node 20 + npm cache on
  `Admin/package-lock.json`, `npm ci`, soft lint, build with dummy
  `.invalid` env URLs).
- Vercel: second project on the same repo, Root Directory `Admin`, later
  domain `admin.woodhouseherbals.com`. The backend must be deployed
  same-site (`api.woodhouseherbals.com`) before production admin login can
  work — already tracked as a known gap.
- `docs/architecture.md`: update step 14 and the "Storefront + Admin"
  line to reflect the separate Admin app.

## 11. Risks and mitigations

- **Migration breadth** (Phase A touches many tables): split into ordered
  migration files (enum additions separate from backfills), test against a
  Neon branch before applying to the dev DB; all changes additive.
- **Storefront regressions**: back-compat sync fields (`inStock`,
  `approved`, category enum) + storefront `npm run build` in CI; the
  storefront is still mostly on mock data, reducing exposure.
- **PhonePe refunds** need real credential testing; the refund endpoint
  ships behind the same env-gating as payments (dev echo mode logs instead
  of calling PhonePe).
- **Scope**: later-phase sections are stubs by design; each gets its own
  spec. Resist building them "while we're in there".
