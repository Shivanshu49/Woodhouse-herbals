# Admin Panel Phase A — Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay every backend foundation the admin panel needs: the full Prisma migration set, the MANAGER role, admin login + role-aware session TTLs, staff password-reset routing, first-admin provisioning, shared pagination, the admin audit trail, and Cloudinary signed uploads.

**Architecture:** All changes live in `Backend/` (NestJS + Prisma → Neon Postgres). The admin panel (built in Phase B+) is a separate Next.js client of this API; nothing here touches `Frontend/`. Every schema change is additive and backward-compatible — the storefront keeps working untouched. Spec: `docs/superpowers/specs/2026-07-03-admin-panel-design.md`.

**Tech Stack:** NestJS 10, Prisma 5.18, PostgreSQL (Neon), class-validator DTOs, node:test (NOT Jest), zod (env only), tsx.

## Global Constraints

- Working directory for all commands: `/home/shivanshu/Desktop/Code/Woodhouse-herbals/Backend` unless stated otherwise.
- Quality gates after every task: `npm run typecheck && npm run build && npm test` must all pass (40 tests pre-existing; count grows as tasks add tests). `npm run lint`/`npm run format` are broken in this repo (eslint/prettier not installed) — do NOT run them; match de-facto style instead: 2-space indent, single quotes, semicolons, trailing commas, ~100-char lines, `// ── Section ──` box comments.
- Tests: Node's built-in `node:test` runner, files named `*.test.ts` colocated next to the unit under test inside `src/` (the test script discovers via `find src -name '*.test.ts'`). Style: `import test from 'node:test'; import assert from 'node:assert/strict';` flat `test('...', ...)` calls, doc comment at top stating the file is pure/no-IO and the single-file run command.
- Money is integer paise; fields suffixed `Minor`.
- All new Prisma models: `String @id @default(cuid())`, `deletedAt` soft delete where applicable, explicit FK pairs, `onDelete: Cascade` for owned children / `SetNull` for actor attribution, additive-only enums.
- Env access ONLY via `src/common/config/env.ts` — never raw `process.env` (exceptions: env.ts itself, tests mutating env before `resetEnvCacheForTests()`).
- Validation: class-validator DTO classes (global ValidationPipe has `whitelist: true, forbidNonWhitelisted: true, transform: true`) — every accepted field must be declared. zod is for env only.
- Commits: author Shivanshu, conventional-commit style (`feat(admin): ...`), NO Claude attribution, NO trailers, NO co-author lines.
- `DATABASE_URL` in `Backend/.env` points at the Neon dev DB — `prisma migrate dev` applies there directly. Do not run `prisma migrate reset` (would wipe seeded data).
- The dev server runs with `npm run start:dev` on port 4000; API prefix is `/api`.

---

### Task 1: Add MANAGER to the UserRole enum (own migration)

Postgres `ALTER TYPE ... ADD VALUE` cannot be bundled with data statements, so this enum change is its own migration, isolated from Task 2's models.

**Files:**
- Modify: `Backend/prisma/schema.prisma:246-250` (UserRole enum)
- Create: `Backend/prisma/migrations/<timestamp>_add_manager_role/migration.sql` (generated)

**Interfaces:**
- Consumes: nothing.
- Produces: `UserRole.MANAGER` usable in `@Roles(UserRole.ADMIN, UserRole.MANAGER)` decorators from Task 6 onward and in all later phases.

- [ ] **Step 1: Edit the enum**

In `Backend/prisma/schema.prisma` replace:

```prisma
enum UserRole {
  CUSTOMER
  STAFF
  ADMIN
}
```

with:

```prisma
enum UserRole {
  CUSTOMER
  STAFF
  // MANAGER sits between ADMIN and STAFF: everything except settings,
  // user management, and refunds. Role checks live in app code (@Roles).
  MANAGER
  ADMIN
}
```

- [ ] **Step 2: Create and apply the migration**

Run: `npx prisma migrate dev --name add_manager_role`
Expected: one new folder under `prisma/migrations/` containing only `ALTER TYPE "UserRole" ADD VALUE 'MANAGER';`, applied cleanly. If Prisma warns about enum addition needing a flush, that is informational.

- [ ] **Step 3: Verify client regenerated and gates pass**

Run: `npx prisma migrate status`
Expected: `Database schema is up to date!`

Run: `npm run typecheck && npm run build && npm test`
Expected: all pass, `tests 40, pass 40`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add MANAGER to UserRole for admin panel roles"
```

---

### Task 2: Admin-panel schema — new models, fields, backfills, settings seed

One migration adds everything the admin panel (all six phases plus the later ones) needs, so the database migrates once. All changes are additive; `Product.status` defaults to `PUBLISHED`, `Review.status` is backfilled from `approved`, and legacy columns (`benefits`, `approved`) are kept in sync until the storefront reads the replacements.

**Files:**
- Modify: `Backend/prisma/schema.prisma` (many blocks — exact edits below)
- Create: `Backend/prisma/migrations/<timestamp>_admin_panel_foundations/migration.sql` (generated then hand-extended)

**Interfaces:**
- Consumes: `UserRole.MANAGER` from Task 1 (no code dependency, just migration ordering).
- Produces: Prisma client types used by every later task/phase: `ProductVariant`, `ProductBenefit`, `ProductCategoryLink`, `OrderNote`, `OrderEvent`, `Refund`, `CouponProduct`, `CouponUser`, `Testimonial`, `Faq`, `StaticPage`, `HomepageSelection`, `StoreSetting`, `AdminAuditLog`; enums `ProductStatus`, `StockStatus`, `GstRate`, `ReviewStatus`, `RefundStatus`, `CouponEligibility`, `RecommendationKind`, `HomepageSection`; extended `CouponKind` (`FREE_SHIPPING`, `BXGY`) and `PaymentStatus` (`PARTIALLY_REFUNDED`).

- [ ] **Step 1: Add new catalog enums**

In `Backend/prisma/schema.prisma`, directly after the `Currency` enum (line 50-52), insert:

```prisma
enum ProductStatus {
  DRAFT
  PUBLISHED
  SCHEDULED
}

enum StockStatus {
  IN_STOCK
  OUT_OF_STOCK
  BACKORDER
}

// GST tax class per product — printed on invoice line items. Checkout
// totals still use the order-level GST_RATE_PERCENT env for now.
enum GstRate {
  EXEMPT
  GST_5
  GST_12
  GST_18
  GST_28
}
```

- [ ] **Step 2: Replace the Concern model** (add `active`)

Replace the whole `model Concern` block with:

```prisma
model Concern {
  id          String        @id @default(cuid())
  slug        String        @unique
  title       String
  description String?
  type        ConcernType
  imageUrl    String?
  accent      String?
  active      Boolean       @default(true)
  sortOrder   Int           @default(0)
  products    ProductConcern[]
  coupons     CouponConcern[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}
```

- [ ] **Step 3: Replace the Category model** (description, SEO, tree, optional enum, links)

Replace the whole `model Category` block with:

```prisma
model Category {
  id              String           @id @default(cuid())
  slug            String           @unique
  name            String
  // Optional since the admin panel introduced free-form categories; the
  // enum remains populated on the original nine for storefront back-compat.
  category        ProductCategory?
  description     String?          @db.Text
  imageUrl        String?
  sortOrder       Int              @default(0)
  metaTitle       String?
  metaDescription String?
  // Tree — top-level categories have parentId = null.
  parent          Category?        @relation("CategoryTree", fields: [parentId], references: [id], onDelete: SetNull)
  parentId        String?
  children        Category[]       @relation("CategoryTree")
  // Soft delete — admin "removes" by setting deletedAt; rows remain so
  // historical orders pointing at this category keep referential integrity.
  deletedAt       DateTime?
  products        Product[]
  productLinks    ProductCategoryLink[]
  coupons         CouponCategory[]
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  @@index([deletedAt])
  @@index([parentId])
}
```

- [ ] **Step 4: Replace the Product model**

Replace the whole `model Product` block with:

```prisma
model Product {
  id                 String           @id @default(cuid())
  slug               String           @unique
  sku                String           @unique
  barcode            String?          @unique
  name               String
  brand              String           @default("Wood House Herbals")
  shortDescription   String
  longDescription    String           @db.Text
  category           ProductCategory
  size               String?
  isCombo            Boolean          @default(false)
  videoUrl           String?
  // Money in paise (minor units).
  priceMinor         Int
  compareAtPriceMinor Int?
  costPriceMinor     Int?
  currency           Currency         @default(INR)
  // GST class + HSN code — shown on invoice line items.
  gstRate            GstRate          @default(GST_18)
  hsnCode            String?
  saleStartsAt       DateTime?
  saleEndsAt         DateTime?
  rating             Float            @default(0)
  reviewCount        Int              @default(0)
  inStock            Boolean          @default(true)
  stockQty           Int              @default(0)
  lowStockThreshold  Int              @default(5)
  allowBackorder     Boolean          @default(false)
  trackInventory     Boolean          @default(true)
  stockStatus        StockStatus      @default(IN_STOCK)
  thumbnailUrl       String
  thumbnailAlt       String
  tags               String[]
  inciText           String?          @db.Text
  // "Free from" flags
  parabenFree        Boolean          @default(false)
  sulfateFree        Boolean          @default(false)
  crueltyFree        Boolean          @default(false)
  vegan              Boolean          @default(false)
  alcoholFree        Boolean          @default(false)
  usageFrequency     String?
  recommendedTime    String?
  // SEO
  metaTitle          String?
  metaDescription    String?
  focusKeyword       String?
  ogImageUrl         String?
  // Shipping
  weightGrams        Int?
  lengthCm           Float?
  widthCm            Float?
  heightCm           Float?
  shippingClass      String?
  freeShipping       Boolean          @default(false)
  // Publish workflow — default PUBLISHED so pre-existing rows stay live.
  status             ProductStatus    @default(PUBLISHED)
  publishAt          DateTime?
  featured           Boolean          @default(false)
  // Soft delete — keeps historical orders viable. Listings must filter.
  deletedAt          DateTime?
  gallery            ProductImage[]
  // DEPRECATED in favour of ProductBenefit rows — kept until the storefront
  // reads the relation; drop in a later cleanup migration.
  benefits           String[]
  howToUse           String[]
  ingredients        Ingredient[]
  badges             ProductBadge[]
  skinTypes          SkinType[]
  concerns           ProductConcern[]
  reviews            Review[]
  cartLines          CartLine[]
  orderItems         OrderItem[]
  recommendations    Recommendation[] @relation("RecForSource")
  recommendedBy      Recommendation[] @relation("RecForTarget")
  inventoryMovements InventoryMovement[]
  // Inverse side of WishlistItem.product (the customer-side rows are
  // navigated through `User.wishlistItems`).
  wishlistedBy       WishlistItem[]
  variants           ProductVariant[]
  benefitItems       ProductBenefit[]
  categoryLinks      ProductCategoryLink[]
  couponScopes       CouponProduct[]
  homepageSelections HomepageSelection[]
  categoryRef        Category?        @relation(fields: [categoryRefId], references: [id])
  categoryRefId      String?
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  @@index([category])
  @@index([rating])
  @@index([priceMinor])
  @@index([deletedAt])
  @@index([status])
}
```

- [ ] **Step 5: Add ProductVariant, ProductBenefit, ProductCategoryLink**

Insert directly after the `model ProductImage` block:

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
  cartLines           CartLine[]
  orderItems          OrderItem[]
  inventoryMovements  InventoryMovement[]
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
```

- [ ] **Step 6: Replace the Recommendation model** (kind discriminator)

Replace the whole `model Recommendation` block with:

```prisma
enum RecommendationKind {
  RELATED
  FREQUENTLY_BOUGHT_TOGETHER
  CROSS_SELL
}

model Recommendation {
  id              String             @id @default(cuid())
  sourceProduct   Product            @relation("RecForSource", fields: [sourceProductId], references: [id], onDelete: Cascade)
  sourceProductId String
  targetProduct   Product            @relation("RecForTarget", fields: [targetProductId], references: [id], onDelete: Cascade)
  targetProductId String
  kind            RecommendationKind @default(RELATED)
  score           Float              @default(0)

  @@unique([sourceProductId, targetProductId, kind])
}
```

- [ ] **Step 7: Add variant column to InventoryMovement**

Inside `model InventoryMovement`, directly after the `productId   String` line, insert:

```prisma
  // Variant this movement applies to — null for base-product stock.
  variant     ProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)
  variantId   String?
```

- [ ] **Step 8: Replace the User model** (admin note, marketing consent, new inverse relations)

Replace the whole `model User` block with (only `adminNote`, `marketingConsent`, `marketingConsentAt` and the five relation lines from `orderNotes` to `adminAuditLogs` are new — everything else is verbatim):

```prisma
model User {
  id                  String     @id @default(cuid())
  // Nullable: phone-OTP accounts start with no email. Unique still enforced
  // for the rows that have one (Postgres ignores NULLs in unique indexes).
  email               String?    @unique
  // Nullable: OTP/Google accounts have no password until the user sets one.
  passwordHash        String?
  fullName            String
  phone               String?    @unique
  // Google OIDC subject — set when the account is created via / linked to
  // "Sign in with Google".
  googleId            String?    @unique
  avatarUrl           String?
  role                UserRole   @default(CUSTOMER)
  skinType            SkinType?
  primaryConcerns     String[]
  // Free-form internal note shown only in the admin panel.
  adminNote           String?    @db.Text
  marketingConsent    Boolean    @default(false)
  marketingConsentAt  DateTime?
  // Email verification
  emailVerified       Boolean    @default(false)
  emailVerifiedAt     DateTime?
  // Brute-force / lockout
  failedLoginAttempts Int        @default(0)
  lockedUntil         DateTime?
  lastLoginAt         DateTime?
  lastLoginIp         String?
  // Password rotation tracking
  passwordChangedAt   DateTime?
  // Soft delete — keeps order history intact. Filter on read paths.
  deletedAt           DateTime?
  // Relations
  addresses           Address[]
  carts               Cart[]
  orders              Order[]
  reviews             Review[]
  refreshTokens       RefreshToken[]
  emailTokens         EmailVerificationToken[]
  resetTokens         PasswordResetToken[]
  authEvents          AuthEvent[]
  wishlistItems       WishlistItem[]
  inventoryActions    InventoryMovement[]
  couponRedemptions   CouponRedemption[]
  orderNotes          OrderNote[]
  orderEvents         OrderEvent[]
  refunds             Refund[]
  couponGrants        CouponUser[]
  adminAuditLogs      AdminAuditLog[]
  createdAt           DateTime   @default(now())
  updatedAt           DateTime   @updatedAt

  @@index([deletedAt])
}
```

- [ ] **Step 9: Add variant column to CartLine (unique key unchanged)**

Replace the whole `model CartLine` block with:

```prisma
model CartLine {
  id             String          @id @default(cuid())
  cart           Cart            @relation(fields: [cartId], references: [id], onDelete: Cascade)
  cartId         String
  product        Product         @relation(fields: [productId], references: [id])
  productId      String
  variant        ProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)
  variantId      String?
  quantity       Int
  unitPriceMinor Int

  // Deliberately still (cartId, productId): Postgres treats NULLs as
  // distinct in unique indexes, so including nullable variantId would admit
  // duplicate no-variant lines and break the cart upsert. Widen only when
  // the storefront cart becomes variant-aware.
  @@unique([cartId, productId])
}
```

- [ ] **Step 10: Extend Order, OrderItem, Payment; add PaymentStatus value**

In `enum PaymentStatus`, after `REFUNDED`, add:

```prisma
  PARTIALLY_REFUNDED
```

In `model Order`, directly after the `redemptions     CouponRedemption[]` line, insert:

```prisma
  notes           OrderNote[]
  events          OrderEvent[]
  refunds         Refund[]
```

In `model OrderItem`, directly after the `skuSnapshot          String` line, insert:

```prisma
  variant              ProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)
  variantId            String?
  variantNameSnapshot  String?
```

In `model Payment`, directly after the `rawResponse     Json?` line, insert:

```prisma
  refunds         Refund[]
```

- [ ] **Step 11: Add OrderNote, OrderEvent, Refund models**

Insert directly after the `model Payment` block:

```prisma
model OrderNote {
  id                String   @id @default(cuid())
  order             Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderId           String
  author            User?    @relation(fields: [authorId], references: [id], onDelete: SetNull)
  authorId          String?
  body              String   @db.Text
  // false = internal admin note; true = shown to the customer.
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

enum RefundStatus {
  PENDING
  PROCESSED
  FAILED
}

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
  providerRefundId String?      @unique // PhonePe refund txn id
  rawResponse      Json?
  actor            User?        @relation(fields: [actorId], references: [id], onDelete: SetNull)
  actorId          String?
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  @@index([orderId])
  @@index([status, createdAt])
}
```

- [ ] **Step 12: Extend Coupon (kinds, BXGY, eligibility, scoping models)**

Replace `enum CouponKind` with:

```prisma
enum CouponKind {
  PERCENT
  FLAT
  FREE_SHIPPING
  BXGY
}

enum CouponEligibility {
  ALL
  FIRST_TIME
  SPECIFIC
}
```

In `model Coupon`, directly after the `perUserLimit    Int?` line, insert:

```prisma
  // BXGY: buy `buyQty` in-scope items, get `getQty` free.
  buyQty          Int?
  getQty          Int?
  eligibility     CouponEligibility @default(ALL)
```

In `model Coupon`, directly after the `concerns        CouponConcern[]` line, insert:

```prisma
  products        CouponProduct[]
  users           CouponUser[]
```

Insert after the `model CouponConcern` block:

```prisma
model CouponProduct {
  coupon    Coupon  @relation(fields: [couponId], references: [id], onDelete: Cascade)
  couponId  String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  productId String
  // false = in scope; true = explicitly excluded from the coupon.
  excluded  Boolean @default(false)

  @@id([couponId, productId])
}

model CouponUser {
  coupon   Coupon @relation(fields: [couponId], references: [id], onDelete: Cascade)
  couponId String
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId   String

  @@id([couponId, userId])
}
```

- [ ] **Step 13: Replace the Review model** (tri-state status, reply, flags)

Replace the whole `model Review` block with:

```prisma
enum ReviewStatus {
  PENDING
  APPROVED
  REJECTED
}

model Review {
  id               String       @id @default(cuid())
  product          Product      @relation(fields: [productId], references: [id], onDelete: Cascade)
  productId        String
  user             User?        @relation(fields: [userId], references: [id])
  userId           String?
  authorName       String
  rating           Int
  title            String
  body             String       @db.Text
  verifiedPurchase Boolean      @default(false)
  // DEPRECATED twin of `status` — kept in sync until the storefront reads
  // `status`; drop in a later cleanup migration.
  approved         Boolean      @default(false)
  status           ReviewStatus @default(PENDING)
  adminReply       String?      @db.Text
  adminReplyAt     DateTime?
  adminReplyBy     String?
  flagged          Boolean      @default(false)
  flagReason       String?
  flaggedAt        DateTime?
  deletedAt        DateTime?
  createdAt        DateTime     @default(now())

  @@index([productId, approved])
  @@index([productId, status])
  // Listing approved reviews by newest first hits this index instead of
  // a sort-on-disk after the [productId, approved] filter.
  @@index([productId, createdAt])
  @@index([deletedAt])
}
```

- [ ] **Step 14: Extend content models; add Testimonial, Faq, StaticPage, HomepageSelection**

Replace `model OfferStripItem` with:

```prisma
model OfferStripItem {
  id        String    @id @default(cuid())
  headline  String
  code      String?
  href      String    @default("/shop")
  sortOrder Int       @default(0)
  active    Boolean   @default(true)
  startsAt  DateTime?
  endsAt    DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}
```

In `model HeroBanner`, directly after the `active    Boolean  @default(true)` line, insert:

```prisma
  sortOrder Int      @default(0)
```

Insert after the `model HeroBanner` block:

```prisma
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
  category  String?  // "shipping" | "products" | "returns"
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

enum HomepageSection {
  FEATURED
  NEW_ARRIVALS
  BEST_SELLERS
  COMBO_PACKS
}

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
```

- [ ] **Step 15: Add StoreSetting and AdminAuditLog** (new "Admin" section at end of file)

Append at the end of `schema.prisma`:

```prisma
// ────────────────────────────────────────────────────────────────
// Admin panel
// ────────────────────────────────────────────────────────────────

model StoreSetting {
  id        String   @id @default(cuid())
  key       String   @unique // "store.name", "shipping.freeAboveMinor", ...
  value     Json
  updatedBy String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model AdminAuditLog {
  id         String   @id @default(cuid())
  actor      User?    @relation(fields: [actorId], references: [id], onDelete: SetNull)
  actorId    String?
  action     String   // "admin-products.update", "uploads.sign", ...
  entityType String   // controller stem, e.g. "AdminProducts"
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

- [ ] **Step 16: Generate the migration WITHOUT applying**

Run: `npx prisma migrate dev --create-only --name admin_panel_foundations`
Expected: new folder `prisma/migrations/<timestamp>_admin_panel_foundations/` with `migration.sql`. Prisma may warn that `Category.category` becomes optional and about the Recommendation unique index change — both intended.

- [ ] **Step 17: Fix the OfferStripItem `updatedAt` DDL for existing rows**

The seed data has 4 OfferStripItem rows, and Prisma emits `ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL` without a default, which fails on a non-empty table. In the generated `migration.sql`, find the `ALTER TABLE "OfferStripItem"` statement and change the updatedAt line to:

```sql
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
```

(Leave the trailing comma/semicolon as the statement requires. `@updatedAt` is maintained by the Prisma client, so a DB default only covers pre-existing rows.)

- [ ] **Step 18: Append backfills and settings seed to the migration**

Append at the end of the generated `migration.sql`:

```sql
-- ── Backfills ─────────────────────────────────────────────────────

-- Review moderation status from the legacy boolean.
UPDATE "Review" SET "status" = 'APPROVED' WHERE "approved" = true;

-- Copy legacy Product.benefits text[] into ProductBenefit rows.
INSERT INTO "ProductBenefit" ("id", "productId", "text", "sortOrder")
SELECT gen_random_uuid()::text, p."id", b.val, (b.ord - 1)::int
FROM "Product" p, LATERAL unnest(p."benefits") WITH ORDINALITY AS b(val, ord);

-- Seed category links from the existing single FK.
INSERT INTO "ProductCategoryLink" ("productId", "categoryId", "isPrimary")
SELECT "id", "categoryRefId", true FROM "Product" WHERE "categoryRefId" IS NOT NULL;

-- ── Default store settings (idempotent) ───────────────────────────
INSERT INTO "StoreSetting" ("id", "key", "value", "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'store.name',                          '"Wood House Herbals"', now(), now()),
  (gen_random_uuid()::text, 'store.tagline',                       'null', now(), now()),
  (gen_random_uuid()::text, 'store.logoUrl',                       'null', now(), now()),
  (gen_random_uuid()::text, 'store.faviconUrl',                    'null', now(), now()),
  (gen_random_uuid()::text, 'store.contactEmail',                  'null', now(), now()),
  (gen_random_uuid()::text, 'store.contactPhone',                  'null', now(), now()),
  (gen_random_uuid()::text, 'store.address',                       'null', now(), now()),
  (gen_random_uuid()::text, 'store.gstin',                         'null', now(), now()),
  (gen_random_uuid()::text, 'store.pan',                           'null', now(), now()),
  (gen_random_uuid()::text, 'store.socialLinks',                   '{}', now(), now()),
  (gen_random_uuid()::text, 'shipping.freeAboveMinor',             '49900', now(), now()),
  (gen_random_uuid()::text, 'inventory.defaultLowStockThreshold',  '5', now(), now()),
  (gen_random_uuid()::text, 'payments.codEnabled',                 'false', now(), now()),
  (gen_random_uuid()::text, 'notifications.adminEmail',            'null', now(), now())
ON CONFLICT ("key") DO NOTHING;
```

- [ ] **Step 19: Apply the migration and regenerate the client**

Run: `npx prisma migrate dev`
Expected: `admin_panel_foundations` applied, client regenerated.

Run: `npx prisma migrate status`
Expected: `Database schema is up to date!`

- [ ] **Step 20: Verify backfills**

Run:

```bash
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  console.log('benefits rows:', await p.productBenefit.count());
  console.log('category links:', await p.productCategoryLink.count());
  console.log('settings:', await p.storeSetting.count());
  console.log('approved reviews with status APPROVED:',
    await p.review.count({ where: { approved: true, status: 'APPROVED' } }));
  await p.\$disconnect();
})();
"
```

Expected: benefits rows > 0 (seeded products have benefits), category links ≥ 0, settings = 14, and the approved/status counts consistent (no approved=true row left at PENDING).

- [ ] **Step 21: Gates pass**

Run: `npm run typecheck && npm run build && npm test`
Expected: all pass, 40/40 tests. (Storefront-facing code compiles untouched because every change is additive.)

- [ ] **Step 22: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): admin panel foundations — variants, order notes/events/refunds, content models, settings, audit log"
```

---

### Task 3: Env additions — admin TTL, admin origin, Cloudinary

**Files:**
- Modify: `Backend/src/common/config/env.ts` (zod schema)
- Modify: `Backend/.env.example`
- Modify: `Backend/.env` (dev values, not committed)

**Interfaces:**
- Consumes: nothing.
- Produces: `env.JWT_ADMIN_REFRESH_TTL: number`, `env.ADMIN_ORIGIN: string | undefined`, `env.CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET: string | undefined` — consumed by Tasks 4, 5, 10.

- [ ] **Step 1: Extend the zod schema**

In `Backend/src/common/config/env.ts`, after the line `JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2592000),  // 30 days`, insert:

```ts
  // Staff/admin refresh TTL — short so an IDLE admin session hard-expires
  // server-side; each rotation re-ups it, so ACTIVE sessions slide forward.
  JWT_ADMIN_REFRESH_TTL: z.coerce.number().int().positive().default(3600), // 60 min
```

After the `GOOGLE_CLIENT_ID: z.string().optional(),` line, insert:

```ts
  // Admin app origin — staff/admin password-reset links point here.
  ADMIN_ORIGIN: z.string().url().optional(),

  // Cloudinary signed uploads (admin media). Optional — the sign endpoint
  // returns 503 until all three are configured.
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
```

- [ ] **Step 2: Update `.env.example`**

Change line 13 from `WEB_ORIGIN=http://localhost:3000` to:

```
WEB_ORIGIN=http://localhost:3000,http://localhost:3001
```

Append at the end of the file:

```
# ── Admin panel ─────────────────────────────────────────────────
# Admin app origin — used for staff/admin password-reset links. The admin
# dev app runs on port 3001 (also listed in WEB_ORIGIN above for CORS).
ADMIN_ORIGIN=http://localhost:3001
# Staff/admin refresh-token TTL in seconds (sliding idle window).
JWT_ADMIN_REFRESH_TTL=3600
# Cloudinary signed uploads (admin media) — optional in dev; the sign
# endpoint returns 503 until all three are set.
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

- [ ] **Step 3: Update local `.env`** (uncommitted)

Add to `Backend/.env`: `ADMIN_ORIGIN=http://localhost:3001`, and extend `WEB_ORIGIN` with `,http://localhost:3001` if it exists there.

- [ ] **Step 4: Gates and commit**

Run: `npm run typecheck && npm run build && npm test`
Expected: all pass.

```bash
git add src/common/config/env.ts .env.example
git commit -m "feat(config): admin refresh TTL, admin origin, and Cloudinary env vars"
```

---

### Task 4: Role-aware refresh TTL

Admin/staff refresh tokens live `JWT_ADMIN_REFRESH_TTL` (60 min) instead of 30 days. Since `refresh()` loads the user and re-calls `issueTokens` with the role, every rotation re-ups the short TTL — a sliding idle window enforced server-side.

**Files:**
- Create: `Backend/src/modules/auth/token-ttl.ts`
- Create: `Backend/src/modules/auth/token-ttl.test.ts`
- Modify: `Backend/src/modules/auth/auth.service.ts` (the `issueTokens` private method)

**Interfaces:**
- Consumes: `env.JWT_REFRESH_TTL`, `env.JWT_ADMIN_REFRESH_TTL` (Task 3).
- Produces: `refreshTtlSecondsForRole(role: UserRole): number` — also used implicitly by every login/refresh path.

- [ ] **Step 1: Write the failing test**

Create `Backend/src/modules/auth/token-ttl.test.ts`:

```ts
/**
 * Pure unit tests for role-aware refresh TTL. No Prisma, no IO.
 * Run this file alone: npx tsx --test src/modules/auth/token-ttl.test.ts
 */
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetEnvCacheForTests } from '../../common/config/env';
import { refreshTtlSecondsForRole } from './token-ttl';

beforeEach(() => {
  process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.JWT_REFRESH_TTL = '2592000';
  process.env.JWT_ADMIN_REFRESH_TTL = '3600';
  resetEnvCacheForTests();
});

test('customers keep the long refresh TTL', () => {
  assert.equal(refreshTtlSecondsForRole('CUSTOMER'), 2592000);
});

test('staff, manager, and admin get the short admin TTL', () => {
  assert.equal(refreshTtlSecondsForRole('STAFF'), 3600);
  assert.equal(refreshTtlSecondsForRole('MANAGER'), 3600);
  assert.equal(refreshTtlSecondsForRole('ADMIN'), 3600);
});

test('admin TTL follows the env override', () => {
  process.env.JWT_ADMIN_REFRESH_TTL = '1800';
  resetEnvCacheForTests();
  assert.equal(refreshTtlSecondsForRole('ADMIN'), 1800);
  assert.equal(refreshTtlSecondsForRole('CUSTOMER'), 2592000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/modules/auth/token-ttl.test.ts`
Expected: FAIL — `Cannot find module './token-ttl'`.

- [ ] **Step 3: Implement**

Create `Backend/src/modules/auth/token-ttl.ts`:

```ts
import type { UserRole } from '@prisma/client';
import { env } from '../../common/config/env';

/**
 * Staff/admin sessions use a much shorter refresh TTL than customers. Each
 * rotation re-issues a full-TTL refresh token, so an ACTIVE admin session
 * slides forward indefinitely while an IDLE one hard-expires server-side
 * within JWT_ADMIN_REFRESH_TTL (default 60 min). The admin app's 30-minute
 * idle timer logs out sooner; this is the server-enforced backstop.
 */
export function refreshTtlSecondsForRole(role: UserRole): number {
  return role === 'CUSTOMER' ? env.JWT_REFRESH_TTL : env.JWT_ADMIN_REFRESH_TTL;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/modules/auth/token-ttl.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire into `issueTokens`**

In `Backend/src/modules/auth/auth.service.ts`, add the import near the other local imports at the top of the file:

```ts
import { refreshTtlSecondsForRole } from './token-ttl';
```

Then inside the private `issueTokens` method, insert one line after the `refreshPayload` declaration and replace the three `env.JWT_REFRESH_TTL` usages:

```ts
    const refreshTtl = refreshTtlSecondsForRole(role);

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: env.JWT_ACCESS_TTL,
    });
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: env.JWT_REFRESH_SECRET,
      expiresIn: refreshTtl,
    });

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        familyId: fam,
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent?.slice(0, 512) ?? null,
      },
    });

    return {
      accessToken,
      refreshToken,
      accessTtlSeconds: env.JWT_ACCESS_TTL,
      refreshTtlSeconds: refreshTtl,
    };
```

(The method's surrounding signature and payload-building lines stay exactly as they are. `refreshTtlSeconds` is what the controller uses for the cookie maxAge, so admin cookies automatically get the short lifetime too.)

- [ ] **Step 6: Gates and commit**

Run: `npm run typecheck && npm run build && npm test`
Expected: all pass, `tests 43, pass 43`.

```bash
git add src/modules/auth/token-ttl.ts src/modules/auth/token-ttl.test.ts src/modules/auth/auth.service.ts
git commit -m "feat(auth): short sliding refresh TTL for staff/manager/admin sessions"
```

---

### Task 5: Staff password-reset links point at the admin app

**Files:**
- Create: `Backend/src/modules/auth/reset-url.ts`
- Create: `Backend/src/modules/auth/reset-url.test.ts`
- Modify: `Backend/src/modules/auth/auth.service.ts` (`requestPasswordReset`)

**Interfaces:**
- Consumes: `env.ADMIN_ORIGIN` (Task 3).
- Produces: `passwordResetUrl(role: UserRole, token: string, webOrigin: string, adminOrigin?: string): string`.

- [ ] **Step 1: Write the failing test**

Create `Backend/src/modules/auth/reset-url.test.ts`:

```ts
/**
 * Pure unit tests for password-reset URL routing. No Prisma, no IO, no env.
 * Run this file alone: npx tsx --test src/modules/auth/reset-url.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordResetUrl } from './reset-url';

const WEB = 'https://woodhouseherbals.com,https://admin.woodhouseherbals.com';

test('customers get the storefront reset page (first WEB_ORIGIN entry)', () => {
  assert.equal(
    passwordResetUrl('CUSTOMER', 'tok', WEB, 'https://admin.woodhouseherbals.com'),
    'https://woodhouseherbals.com/account/reset?token=tok',
  );
});

test('staff/manager/admin get the admin reset page when ADMIN_ORIGIN is set', () => {
  for (const role of ['STAFF', 'MANAGER', 'ADMIN'] as const) {
    assert.equal(
      passwordResetUrl(role, 'tok', WEB, 'https://admin.woodhouseherbals.com'),
      'https://admin.woodhouseherbals.com/reset?token=tok',
    );
  }
});

test('staff fall back to the storefront page when ADMIN_ORIGIN is unset', () => {
  assert.equal(
    passwordResetUrl('ADMIN', 'tok', WEB, undefined),
    'https://woodhouseherbals.com/account/reset?token=tok',
  );
});

test('token is URL-encoded and trailing slashes are trimmed', () => {
  assert.equal(
    passwordResetUrl('ADMIN', 'a+b/c', WEB, 'http://localhost:3001/'),
    'http://localhost:3001/reset?token=a%2Bb%2Fc',
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/modules/auth/reset-url.test.ts`
Expected: FAIL — `Cannot find module './reset-url'`.

- [ ] **Step 3: Implement**

Create `Backend/src/modules/auth/reset-url.ts`:

```ts
import type { UserRole } from '@prisma/client';

/**
 * Staff/manager/admin accounts get reset links pointing at the admin app
 * (when ADMIN_ORIGIN is configured); customers keep the storefront page.
 * The storefront origin is the FIRST entry of the comma-separated
 * WEB_ORIGIN list — the same convention the email-verification link uses.
 */
export function passwordResetUrl(
  role: UserRole,
  token: string,
  webOrigin: string,
  adminOrigin?: string,
): string {
  const encoded = encodeURIComponent(token);
  if (role !== 'CUSTOMER' && adminOrigin) {
    return `${adminOrigin.replace(/\/+$/, '')}/reset?token=${encoded}`;
  }
  const base = (webOrigin.split(',')[0] ?? '').trim().replace(/\/+$/, '');
  return `${base}/account/reset?token=${encoded}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/modules/auth/reset-url.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire into `requestPasswordReset`**

In `Backend/src/modules/auth/auth.service.ts`, add the import near the other local imports:

```ts
import { passwordResetUrl } from './reset-url';
```

In the `requestPasswordReset` method, replace the line:

```ts
      const url = `${env.WEB_ORIGIN.split(',')[0]}/account/reset?token=${encodeURIComponent(raw)}`;
```

with:

```ts
      const url = passwordResetUrl(user.role, raw, env.WEB_ORIGIN, env.ADMIN_ORIGIN);
```

- [ ] **Step 6: Gates and commit**

Run: `npm run typecheck && npm run build && npm test`
Expected: all pass, `tests 47, pass 47`.

```bash
git add src/modules/auth/reset-url.ts src/modules/auth/reset-url.test.ts src/modules/auth/auth.service.ts
git commit -m "feat(auth): route staff password-reset links to the admin app"
```

---

### Task 6: `POST /api/auth/admin-login`

A thin wrapper over the battle-tested `login`: identical behaviour for bad credentials, but valid CUSTOMER credentials are answered with the same 401 (no enumeration) and the just-minted refresh family is revoked, so customer credentials never yield admin-surface cookies.

**Files:**
- Modify: `Backend/src/modules/auth/auth.service.ts` (new `adminLogin` method, after `login`)
- Modify: `Backend/src/modules/auth/auth.controller.ts` (new route, after the `login` handler)

**Interfaces:**
- Consumes: `AuthService.login`, `AuthService.logout` (existing), `this.events.record` (existing).
- Produces: `POST /api/auth/admin-login` accepting `LoginDto { email, password }`, returning `{ user: { id, email, fullName, role } }` + auth cookies. The Phase B admin app logs in against exactly this route.

- [ ] **Step 1: Add the service method**

In `Backend/src/modules/auth/auth.service.ts`, directly after the closing brace of the `login` method, insert:

```ts
  /**
   * Admin-surface login. Reuses the full `login` path (lockout, timing-safe
   * compares, audit events), then refuses CUSTOMER accounts with the SAME
   * message as bad credentials so this endpoint cannot be used to probe
   * which emails exist. The refresh token the shared path just minted is
   * revoked before the rejection, so no dangling session survives.
   */
  async adminLogin(dto: { email: string; password: string }, ctx: RequestContext) {
    const result = await this.login(dto, ctx);
    if (result.user.role === 'CUSTOMER') {
      await this.logout(result.tokens.refreshToken, result.user.id, ctx);
      await this.events.record({
        userId: result.user.id,
        type: 'LOGIN_FAILURE',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        meta: { reason: 'not_staff', surface: 'admin' },
      });
      throw new UnauthorizedException('Invalid email or password');
    }
    return result;
  }
```

(`UnauthorizedException` is already imported in this file.)

- [ ] **Step 2: Add the controller route**

In `Backend/src/modules/auth/auth.controller.ts`, directly after the closing brace of the `login` handler, insert:

```ts
  // Admin-surface login — same throttle budget as customer login. Rejects
  // CUSTOMER accounts (with an identical 401) before any cookie is set.
  @Public()
  @Throttle({ default: { ttl: 15 * 60 * 1000, limit: 10 } })
  @Post('admin-login')
  @HttpCode(200)
  async adminLogin(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.adminLogin(dto, ctxFromRequest(req));
    this.setAuthCookies(res, tokens);
    return { user };
  }
```

- [ ] **Step 3: Gates**

Run: `npm run typecheck && npm run build && npm test`
Expected: all pass.

- [ ] **Step 4: Manual verification (customer rejection path)**

Start the API: `npm run start:dev` (leave running; port 4000).

Register a throwaway customer (dev auto-verifies when RESEND_API_KEY is unset):

```bash
curl -s -X POST http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"probe-customer@example.com","password":"Adm1n!Passw0rd#2026","fullName":"Probe Customer"}'
```

Then:

```bash
curl -si -X POST http://localhost:4000/api/auth/admin-login \
  -H 'Content-Type: application/json' \
  -d '{"email":"probe-customer@example.com","password":"Adm1n!Passw0rd#2026"}' | head -3
```

Expected: `HTTP/1.1 401 Unauthorized` and NO `Set-Cookie` header. (The success path is verified in Task 7 once an admin exists.)

- [ ] **Step 5: Commit**

```bash
git add src/modules/auth/auth.service.ts src/modules/auth/auth.controller.ts
git commit -m "feat(auth): admin-login endpoint that refuses customer accounts"
```

---

### Task 7: First-admin provisioning script (`npm run admin:create`)

**Files:**
- Create: `Backend/prisma/seed-admin.ts`
- Modify: `Backend/package.json` (scripts)

**Interfaces:**
- Consumes: `hashPassword`, `validatePasswordStrength` from `src/common/utils/passwords.ts`.
- Produces: an idempotent CLI that upserts an ADMIN user from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars. Later phases assume at least one ADMIN exists.

- [ ] **Step 1: Write the script**

Create `Backend/prisma/seed-admin.ts`:

```ts
/**
 * First-admin provisioning — run once per environment:
 *
 *   ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD='...' npm run admin:create
 *
 * Idempotent: an existing user with that email is PROMOTED to ADMIN (and
 * marked email-verified) but their password is never overwritten. Never
 * bake credentials into the repo or .env files.
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword, validatePasswordStrength } from '../src/common/utils/passwords';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME ?? 'Store Owner';

  if (!email || !password) {
    console.error('Usage: ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD=... npm run admin:create');
    process.exit(1);
  }

  const errors = validatePasswordStrength(password);
  if (errors.length) {
    console.error('✖ Password rejected:');
    for (const e of errors) console.error(`  • ${e}`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();
  const user = await prisma.user.upsert({
    where: { email },
    // Existing account: promote + verify, but never overwrite the password.
    update: { role: 'ADMIN', emailVerified: true, emailVerifiedAt: now, deletedAt: null },
    create: {
      email,
      passwordHash,
      fullName,
      role: 'ADMIN',
      emailVerified: true,
      emailVerifiedAt: now,
      passwordChangedAt: now,
    },
    select: { id: true, email: true, role: true },
  });
  console.log(`✔ Admin ready: ${user.email} (${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Add the npm script**

In `Backend/package.json`, after the `"prisma:seed"` line, add:

```json
    "admin:create": "tsx prisma/seed-admin.ts",
```

- [ ] **Step 3: Run it against the dev DB**

Run:

```bash
ADMIN_EMAIL=owner@woodhouseherbals.test ADMIN_PASSWORD='Adm1n!Passw0rd#2026' npm run admin:create
```

Expected: `✔ Admin ready: owner@woodhouseherbals.test (<cuid>)`. Run it a second time — same output, no error (idempotent).

- [ ] **Step 4: Manual verification — admin-login success path**

With the dev server from Task 6 still running:

```bash
curl -si -X POST http://localhost:4000/api/auth/admin-login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@woodhouseherbals.test","password":"Adm1n!Passw0rd#2026"}' | grep -E 'HTTP|Set-Cookie|"role"'
```

Expected: `HTTP/1.1 200 OK`, two `Set-Cookie` headers (`wh_at=...` and `wh_rt=...` with `Path=/api/auth`), and a body containing `"role":"ADMIN"`. The `wh_rt` cookie's `Max-Age` should be `3600` (Task 4's short TTL), not 2592000.

- [ ] **Step 5: Gates and commit**

Run: `npm run typecheck && npm run build && npm test`
Expected: all pass.

```bash
git add prisma/seed-admin.ts package.json
git commit -m "feat(auth): idempotent first-admin provisioning script"
```

---

### Task 8: Shared pagination DTO + helper

Every admin list endpoint (Phases C–F) uses the `{ items, total, page, perPage }` contract. This task creates the single shared implementation.

**Files:**
- Create: `Backend/src/common/dto/pagination.dto.ts`
- Create: `Backend/src/common/dto/pagination.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `class PaginationDto { page?: number = 1; perPage?: number = 25 }` (class-validator, extend in admin list DTOs)
  - `interface Paginated<T> { items: T[]; total: number; page: number; perPage: number }`
  - `pageArgs(dto: { page?: number; perPage?: number }): { skip: number; take: number; page: number; perPage: number }`

- [ ] **Step 1: Write the failing test**

Create `Backend/src/common/dto/pagination.test.ts`:

```ts
/**
 * Pure unit tests for pagination math. No Prisma, no IO.
 * Run this file alone: npx tsx --test src/common/dto/pagination.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pageArgs } from './pagination.dto';

test('defaults to page 1, 25 per page', () => {
  assert.deepEqual(pageArgs({}), { skip: 0, take: 25, page: 1, perPage: 25 });
});

test('computes skip from page and perPage', () => {
  assert.deepEqual(pageArgs({ page: 3, perPage: 10 }), { skip: 20, take: 10, page: 3, perPage: 10 });
});

test('first page has zero skip regardless of perPage', () => {
  assert.equal(pageArgs({ page: 1, perPage: 100 }).skip, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/common/dto/pagination.test.ts`
Expected: FAIL — `Cannot find module './pagination.dto'`.

- [ ] **Step 3: Implement**

Create `Backend/src/common/dto/pagination.dto.ts`:

```ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Shared offset pagination for admin list endpoints. Extend in list DTOs:
 *
 *   export class ListOrdersDto extends PaginationDto { ... }
 *
 * Response contract: { items, total, page, perPage } (see Paginated<T>).
 */
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number = 25;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}

/** Prisma skip/take from a (possibly partial) pagination input. */
export function pageArgs(dto: { page?: number; perPage?: number }): {
  skip: number;
  take: number;
  page: number;
  perPage: number;
} {
  const page = dto.page ?? 1;
  const perPage = dto.perPage ?? 25;
  return { skip: (page - 1) * perPage, take: perPage, page, perPage };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/common/dto/pagination.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Gates and commit**

Run: `npm run typecheck && npm run build && npm test`
Expected: all pass, `tests 50, pass 50`.

```bash
git add src/common/dto/pagination.dto.ts src/common/dto/pagination.test.ts
git commit -m "feat(common): shared pagination DTO and page-args helper for admin lists"
```

---

### Task 9: Admin audit module (service + interceptor)

Every admin mutation gets an `AdminAuditLog` row. The interceptor is attached per admin controller with `@UseInterceptors(AdminAuditInterceptor)`; it audits mutating methods only and must never fail the request it records.

**Files:**
- Create: `Backend/src/common/audit/audit-action.ts`
- Create: `Backend/src/common/audit/audit-action.test.ts`
- Create: `Backend/src/common/audit/audit.service.ts`
- Create: `Backend/src/common/audit/admin-audit.interceptor.ts`
- Create: `Backend/src/common/audit/audit.module.ts`
- Modify: `Backend/src/app.module.ts` (register AuditModule)

**Interfaces:**
- Consumes: `PrismaService` (PrismaModule is effectively global — modules like CouponsModule inject `PrismaService` without importing PrismaModule), `AdminAuditLog` model (Task 2).
- Produces:
  - `AuditService.record(entry: AuditEntry): Promise<void>` where `AuditEntry = { actorId?, action, entityType, entityId?, before?, after?, ip?, userAgent? }`
  - `AdminAuditInterceptor` (attach with `@UseInterceptors(AdminAuditInterceptor)` — used by Task 10 and every `/admin` controller in later phases)
  - `deriveAuditAction(className: string, handlerName: string): string`, `deriveEntityType(className: string): string`

- [ ] **Step 1: Write the failing test**

Create `Backend/src/common/audit/audit-action.test.ts`:

```ts
/**
 * Pure unit tests for audit action derivation. No Prisma, no IO.
 * Run this file alone: npx tsx --test src/common/audit/audit-action.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveAuditAction, deriveEntityType } from './audit-action';

test('kebab-cases the controller stem and appends the handler', () => {
  assert.equal(deriveAuditAction('AdminProductsController', 'update'), 'admin-products.update');
  assert.equal(deriveAuditAction('UploadsController', 'sign'), 'uploads.sign');
});

test('handles single-word controllers', () => {
  assert.equal(deriveAuditAction('CouponsController', 'create'), 'coupons.create');
});

test('entity type is the controller stem', () => {
  assert.equal(deriveEntityType('AdminProductsController'), 'AdminProducts');
  assert.equal(deriveEntityType('UploadsController'), 'Uploads');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/common/audit/audit-action.test.ts`
Expected: FAIL — `Cannot find module './audit-action'`.

- [ ] **Step 3: Implement the pure helpers**

Create `Backend/src/common/audit/audit-action.ts`:

```ts
/**
 * Derive audit identifiers from NestJS controller/handler names:
 *   ('AdminProductsController', 'update') → 'admin-products.update'
 * Keeping this pure (and tested) means the interceptor itself stays a thin
 * untested shell, per this codebase's convention.
 */
export function deriveAuditAction(className: string, handlerName: string): string {
  const stem = className.replace(/Controller$/, '');
  const kebab = stem.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return `${kebab}.${handlerName}`;
}

export function deriveEntityType(className: string): string {
  return className.replace(/Controller$/, '');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/common/audit/audit-action.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement the service**

Create `Backend/src/common/audit/audit.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('AdminAudit');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Append-only. NEVER throws — a failed audit write must not fail the
   * mutation it records; it is logged for ops instead.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.adminAuditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
          after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent?.slice(0, 512) ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`audit write failed for ${entry.action}: ${(err as Error).message}`);
    }
  }
}
```

- [ ] **Step 6: Implement the interceptor**

Create `Backend/src/common/audit/admin-audit.interceptor.ts`:

```ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';
import { AuditService } from './audit.service';
import { deriveAuditAction, deriveEntityType } from './audit-action';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Attach with @UseInterceptors(AdminAuditInterceptor) on every /admin
 * controller. Records one AdminAuditLog row per SUCCESSFUL mutating request
 * (GETs and failed requests are not audited). The response body is stored
 * as `after`; services that can produce cheap `before` snapshots may call
 * AuditService.record directly instead and skip the interceptor's row by
 * keeping their handler names distinct.
 */
@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!MUTATING.has(req.method)) return next.handle();

    const action = deriveAuditAction(ctx.getClass().name, ctx.getHandler().name);
    const entityType = deriveEntityType(ctx.getClass().name);
    const params = req.params as Record<string, string | undefined>;

    return next.handle().pipe(
      tap((result) => {
        void this.audit.record({
          actorId: req.user?.sub,
          action,
          entityType,
          entityId: params.id ?? params.number ?? params.productId,
          after: result,
          ip: req.ip,
          userAgent: req.headers['user-agent'] as string | undefined,
        });
      }),
    );
  }
}
```

- [ ] **Step 7: Create the module and register it**

Create `Backend/src/common/audit/audit.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AdminAuditInterceptor } from './admin-audit.interceptor';

// Global so every admin module can @UseInterceptors(AdminAuditInterceptor)
// and inject AuditService without importing this module each time.
@Global()
@Module({
  providers: [AuditService, AdminAuditInterceptor],
  exports: [AuditService, AdminAuditInterceptor],
})
export class AuditModule {}
```

In `Backend/src/app.module.ts`, add the import:

```ts
import { AuditModule } from './common/audit/audit.module';
```

and add `AuditModule,` to the `imports` array directly after `SecurityModule,`.

- [ ] **Step 8: Gates and commit**

Run: `npm run typecheck && npm run build && npm test`
Expected: all pass, `tests 53, pass 53`.

```bash
git add src/common/audit src/app.module.ts
git commit -m "feat(admin): audit-log service and interceptor for admin mutations"
```

---

### Task 10: Cloudinary signed-upload module

`POST /api/admin/uploads/sign` returns signed parameters; the admin app's browser then uploads the file straight to Cloudinary (no file bytes through our API, dodging the 256 KB body cap). The API secret never leaves the server.

**Files:**
- Create: `Backend/src/modules/uploads/cloudinary-signature.ts`
- Create: `Backend/src/modules/uploads/cloudinary-signature.test.ts`
- Create: `Backend/src/modules/uploads/dto/sign-upload.dto.ts`
- Create: `Backend/src/modules/uploads/uploads.service.ts`
- Create: `Backend/src/modules/uploads/uploads.controller.ts`
- Create: `Backend/src/modules/uploads/uploads.module.ts`
- Modify: `Backend/src/app.module.ts` (register UploadsModule)

**Interfaces:**
- Consumes: `env.CLOUDINARY_*` (Task 3), `AdminAuditInterceptor` (Task 9), `Roles`/`UserRole` (existing + Task 1).
- Produces: `POST /api/admin/uploads/sign` with body `{ folder: 'products' | 'banners' | 'content' }` → `{ cloudName, apiKey, timestamp, folder, signature, uploadUrl }`. The Phase B/D admin app image-upload component consumes exactly this shape. Also `signCloudinaryParams(params, apiSecret): string`.

- [ ] **Step 1: Write the failing test**

Create `Backend/src/modules/uploads/cloudinary-signature.test.ts`:

```ts
/**
 * Pure unit tests for the Cloudinary signature. No Prisma, no IO, no env.
 * Vectors precomputed with: printf '%s' '<sorted-params><secret>' | sha1sum
 * Run this file alone: npx tsx --test src/modules/uploads/cloudinary-signature.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { signCloudinaryParams } from './cloudinary-signature';

const SECRET = 's3cr3t-api-secret';

test('signs sorted key=value pairs joined with & plus the secret (sha1 hex)', () => {
  assert.equal(
    signCloudinaryParams({ folder: 'woodhouse/products', timestamp: 1700000000 }, SECRET),
    'd095c6d5d9474004627e4be1f3d4eeec3c15fcb2',
  );
  assert.equal(
    signCloudinaryParams({ folder: 'woodhouse/banners', timestamp: 1700000000 }, SECRET),
    '1d5eac9aa24fc7952db7a48199044e85c8e42a4c',
  );
});

test('parameter order does not matter (keys are sorted)', () => {
  assert.equal(
    signCloudinaryParams({ timestamp: 1700000000, folder: 'woodhouse/products' }, SECRET),
    signCloudinaryParams({ folder: 'woodhouse/products', timestamp: 1700000000 }, SECRET),
  );
});

test('undefined and empty params are excluded from the signature', () => {
  assert.equal(
    signCloudinaryParams(
      { folder: 'woodhouse/products', timestamp: 1700000000, eager: undefined, tags: '' },
      SECRET,
    ),
    'd095c6d5d9474004627e4be1f3d4eeec3c15fcb2',
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/modules/uploads/cloudinary-signature.test.ts`
Expected: FAIL — `Cannot find module './cloudinary-signature'`.

- [ ] **Step 3: Implement the signature function**

Create `Backend/src/modules/uploads/cloudinary-signature.ts`:

```ts
import { createHash } from 'node:crypto';

/**
 * Cloudinary signed-upload signature: SHA-1 hex over the alphabetically
 * sorted `key=value` pairs joined with '&', with the API secret appended.
 * https://cloudinary.com/documentation/upload_images#generating_authentication_signatures
 * Empty/undefined params are excluded (Cloudinary ignores them too).
 */
export function signCloudinaryParams(
  params: Record<string, string | number | boolean | undefined>,
  apiSecret: string,
): string {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1').update(toSign + apiSecret).digest('hex');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/modules/uploads/cloudinary-signature.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: DTO, service, controller, module**

Create `Backend/src/modules/uploads/dto/sign-upload.dto.ts`:

```ts
import { IsIn } from 'class-validator';

export const UPLOAD_FOLDERS = ['products', 'banners', 'content'] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export class SignUploadDto {
  @IsIn(UPLOAD_FOLDERS)
  folder!: UploadFolder;
}
```

Create `Backend/src/modules/uploads/uploads.service.ts`:

```ts
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { env } from '../../common/config/env';
import { signCloudinaryParams } from './cloudinary-signature';

@Injectable()
export class UploadsService {
  /**
   * Returns everything the browser needs to POST a file DIRECTLY to
   * Cloudinary (multipart fields: file, api_key, timestamp, folder,
   * signature). The API secret stays server-side.
   */
  sign(input: { folder: string }) {
    const cloudName = env.CLOUDINARY_CLOUD_NAME;
    const apiKey = env.CLOUDINARY_API_KEY;
    const apiSecret = env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException('Image uploads are not configured.');
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `woodhouse/${input.folder}`;
    const signature = signCloudinaryParams({ folder, timestamp }, apiSecret);
    return {
      cloudName,
      apiKey,
      timestamp,
      folder,
      signature,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    };
  }
}
```

Create `Backend/src/modules/uploads/uploads.controller.ts`:

```ts
import { Body, Controller, HttpCode, Post, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { UploadsService } from './uploads.service';
import { SignUploadDto } from './dto/sign-upload.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAuditInterceptor } from '../../common/audit/admin-audit.interceptor';

@Controller('admin/uploads')
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@UseInterceptors(AdminAuditInterceptor)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  // Signatures are cheap but rate-limited anyway — a gallery upload burst
  // is ~10 signatures; 30/min leaves headroom without enabling abuse.
  @Throttle({ default: { ttl: 60 * 1000, limit: 30 } })
  @Post('sign')
  @HttpCode(200)
  sign(@Body() dto: SignUploadDto) {
    return this.uploads.sign(dto);
  }
}
```

Create `Backend/src/modules/uploads/uploads.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
```

In `Backend/src/app.module.ts`, add the import:

```ts
import { UploadsModule } from './modules/uploads/uploads.module';
```

and add `UploadsModule,` to the `imports` array directly after `ShipmentsModule,`.

- [ ] **Step 6: Gates**

Run: `npm run typecheck && npm run build && npm test`
Expected: all pass, `tests 56, pass 56`.

- [ ] **Step 7: Manual verification (auth + 503 unconfigured path + audit row)**

With the dev server running and the Task 7 admin cookies saved:

```bash
# Login and keep cookies
curl -s -c /tmp/wh-admin.jar -X POST http://localhost:4000/api/auth/admin-login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@woodhouseherbals.test","password":"Adm1n!Passw0rd#2026"}' > /dev/null

# Unauthenticated → 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:4000/api/admin/uploads/sign \
  -H 'Content-Type: application/json' -d '{"folder":"products"}'

# Authenticated, Cloudinary env unset → 503
curl -s -b /tmp/wh-admin.jar -o /dev/null -w '%{http_code}\n' -X POST http://localhost:4000/api/admin/uploads/sign \
  -H 'Content-Type: application/json' -d '{"folder":"products"}'
```

Expected: `401` then `503`. If you set the three `CLOUDINARY_*` vars in `Backend/.env` and restart, the same call returns `200` with `signature` — and writes an audit row; verify with:

```bash
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.adminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 3 })
  .then((r) => { console.log(r.map((x) => x.action)); return p.\$disconnect(); });
"
```

Expected: includes `uploads.sign` (only when the 200 path ran; 503s are not audited because the handler threw).

- [ ] **Step 8: Commit**

```bash
git add src/modules/uploads src/app.module.ts
git commit -m "feat(admin): Cloudinary signed-upload endpoint for admin media"
```

---

### Task 11: Config + docs sync

**Files:**
- Modify: `docs/architecture.md` (repo root `docs/`, not `Backend/`)

**Interfaces:**
- Consumes: decisions recorded in `docs/superpowers/specs/2026-07-03-admin-panel-design.md`.
- Produces: architecture doc consistent with the separate-Admin-app decision.

- [ ] **Step 1: Update the architecture diagram label**

In `docs/architecture.md`, the diagram box on line 8 reads `│  Storefront + Admin  │`. Replace that line with:

```
│  Storefront only     │
```

and directly under the closing fence of that diagram add the paragraph:

```markdown
The admin panel is a **separate Next.js app** (`Admin/`, dev port 3001) that
consumes the same NestJS API via `/api/admin/*` endpoints — see
`docs/superpowers/specs/2026-07-03-admin-panel-design.md`.
```

- [ ] **Step 2: Update build-order step 14**

Replace the line:

```
14. Admin endpoints + AdminJS-style UI for products/orders/coupons/inventory
```

with:

```
14. Admin panel — separate `Admin/` Next.js app + `/api/admin/*` endpoints
    (spec: docs/superpowers/specs/2026-07-03-admin-panel-design.md) — IN PROGRESS
```

- [ ] **Step 3: Commit**

```bash
cd /home/shivanshu/Desktop/Code/Woodhouse-herbals
git add docs/architecture.md
git commit -m "docs(architecture): admin panel is a separate app; mark step 14 in progress"
```

---

## Completion checklist (whole phase)

- [ ] `npm run typecheck && npm run build && npm test` green in `Backend/` (56 tests).
- [ ] `npx prisma migrate status` reports up to date; two new migrations exist.
- [ ] `npm run admin:create` provisions/promotes an ADMIN idempotently.
- [ ] `POST /api/auth/admin-login`: 401 for customers (no cookies), 200 + short-TTL cookies for staff/admin.
- [ ] `POST /api/admin/uploads/sign`: 401 unauthenticated, 503 unconfigured, 200 + valid signature configured, audit row written.
- [ ] Storefront unaffected: `cd ../Frontend && npm run build` still green.
