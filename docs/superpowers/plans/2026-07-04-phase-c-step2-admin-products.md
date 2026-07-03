# Phase C · Step 2 — admin-products API endpoints (build spec)

Backend-only. Build the `admin-products` NestJS module + fix the storefront draft leak. No UI. Scope decisions (locked with the owner): **defer variants**, **create sets stock / edit read-only**, **fix the storefront draft leak now**.

Working dir: `/home/shivanshu/Desktop/Code/Woodhouse-herbals/Backend`. Conventions: copy the coupons module trio (`src/modules/coupons/*`) and Phase A pieces. Gates: `npm run typecheck && npm run build && npm test` (56 tests today; grows). No lint (broken). Commit author Shivanshu, no trailers.

## Files to create

```
src/modules/admin-products/
  admin-products.module.ts
  admin-products.controller.ts
  admin-products.service.ts
  dto/list-admin-products.dto.ts
  dto/create-product.dto.ts
  dto/update-product.dto.ts
  dto/bulk-products.dto.ts
  product-slug.ts              + product-slug.test.ts
  admin-product-where.ts       + admin-product-where.test.ts
  bulk-action.ts               + bulk-action.test.ts
```
Modify: `src/app.module.ts` (register `AdminProductsModule`), `src/modules/products/products.service.ts` (draft-leak fix).

## Controller — `@Controller('admin/products')`

Class-level: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@UseInterceptors(AdminAuditInterceptor)` (from `../../common/audit/admin-audit.interceptor`). Reads allow STAFF; writes are ADMIN+MANAGER.

Declare `slug-check` BEFORE `:id` so it isn't captured as an id param.

| Method | Path | Roles | Handler |
|---|---|---|---|
| GET | `` (list) | ADMIN, MANAGER, STAFF | `service.adminList(dto)` |
| GET | `slug-check` | ADMIN, MANAGER, STAFF | `service.slugCheck(slug, excludeId)` |
| GET | `:id` | ADMIN, MANAGER, STAFF | `service.adminGetById(id)` |
| POST | `` | ADMIN, MANAGER | `service.create(dto, user.sub)` |
| PATCH | `:id` | ADMIN, MANAGER | `service.update(id, dto)` |
| DELETE | `:id` | ADMIN, MANAGER | `service.softDelete(id)` → `{ ok: true }` |
| POST | `:id/restore` | ADMIN, MANAGER | `service.restore(id)` → `{ ok: true }` |
| POST | `bulk` | ADMIN, MANAGER | `service.bulk(dto)` → `{ updated: n }` |

Actor id via `@CurrentUser()` (`../../common/decorators/current-user.decorator`) → `user.sub` for `create` (INITIAL_SEED movement attribution).

## DTOs (class-validator; global ValidationPipe strips unknown keys → 400 on extras)

### `ListAdminProductsDto extends PaginationDto`
`PaginationDto` is `src/common/dto/pagination.dto.ts` (page default 1, perPage default 25 max 100). Add:
- `q?: string` (`@IsOptional @IsString`) — matches name OR sku, case-insensitive.
- `status?: 'DRAFT' | 'PUBLISHED' | 'SCHEDULED'` (`@IsOptional @IsEnum(ProductStatus)`).
- `category?: string` (`@IsOptional @IsEnum(ProductCategory)`).
- `stock?: 'in' | 'out' | 'low'` (`@IsOptional @IsIn(['in','out','low'])`).
- `priceMin?: number`, `priceMax?: number` (`@IsOptional @Type(()=>Number) @IsInt @Min(0)`) — RUPEES; the where-builder multiplies by 100.
- `sort?` (`@IsOptional @IsEnum(AdminProductSort)`) — enum `AdminProductSort { Newest='newest', Oldest='oldest', PriceAsc='price-asc', PriceDesc='price-desc', StockAsc='stock-asc', StockDesc='stock-desc', Name='name' }` default Newest.
- `deleted?: boolean` (`@IsOptional @Type(()=>Boolean) @IsBoolean`) — when true, show ONLY archived (soft-deleted) rows; otherwise active only.

### `CreateProductDto` — the full product. Fields (all validated):
Required: `name` (`@IsString @MaxLength(200)`), `slug` (`@IsString @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)`), `sku` (`@IsString @MaxLength(64)`), `shortDescription` (`@IsString @MaxLength(400)`), `longDescription` (`@IsString`), `category` (`@IsEnum(ProductCategory)`), `priceMinor` (`@IsInt @Min(0)`), `thumbnailUrl` (`@IsString`), `thumbnailAlt` (`@IsString`).
Optional scalars: `barcode?`, `brand?` (default handled server-side), `size?`, `isCombo?` (`@IsBoolean`), `videoUrl?`, `compareAtPriceMinor?` (`@IsInt @Min(0)`), `costPriceMinor?` (`@IsInt @Min(0)`), `gstRate?` (`@IsEnum(GstRate)`), `hsnCode?`, `saleStartsAt?`/`saleEndsAt?` (`@IsDateString`), `stockQty?` (`@IsInt @Min(0)` default 0 — CREATE ONLY), `lowStockThreshold?` (`@IsInt @Min(0)`), `allowBackorder?`/`trackInventory?`/`featured?` (`@IsBoolean`), free-from flags `parabenFree?`/`sulfateFree?`/`crueltyFree?`/`vegan?`/`alcoholFree?` (`@IsBoolean`), `inciText?`, `usageFrequency?`, `recommendedTime?`, SEO `metaTitle?`/`metaDescription?`/`focusKeyword?`/`ogImageUrl?`, shipping `weightGrams?` (`@IsInt @Min(0)`)/`lengthCm?`/`widthCm?`/`heightCm?` (`@IsNumber`)/`shippingClass?`/`freeShipping?` (`@IsBoolean`), `status?` (`@IsEnum(ProductStatus)` default PUBLISHED), `publishAt?` (`@IsDateString`).
Array scalars: `tags?: string[]`, `howToUse?: string[]`, `benefits?: string[]` (legacy — accept but prefer `benefitItems`), `skinTypes?: SkinType[]` (`@IsEnum(SkinType,{each:true})`).
Nested (each `@IsOptional @IsArray @ValidateNested({each:true}) @Type(()=>X)`):
- `gallery?: { url: string; alt: string; width?: number; height?: number; sortOrder?: number }[]`
- `ingredients?: { name: string; benefit: string; iconUrl?: string; sortOrder?: number }[]`
- `benefitItems?: { text: string; iconUrl?: string; sortOrder?: number }[]`
- `badges?: { label: string; tone: BadgeTone }[]` (`@IsEnum(BadgeTone)`)
- `concernIds?: string[]` (`@IsString({each:true})`) → ProductConcern rows
- `categoryIds?: string[]` → ProductCategoryLink rows (first is `isPrimary: true`)
- `recommendations?: { targetProductId: string; kind?: RecommendationKind; score?: number }[]`

### `UpdateProductDto`
Same shape as CreateProductDto but EVERY field optional, and it MUST NOT declare `stockQty`, `rating`, or `reviewCount` (so the ValidationPipe rejects them with 400 — stock is inventory-owned, rating is review-owned). Simplest: hand-write it as a separate class (do NOT extend Create with PartialType if that would re-admit stockQty).

### `BulkProductsDto`
- `ids: string[]` (`@IsArray @IsString({each:true}) @ArrayNotEmpty`)
- `action` (`@IsEnum(BulkAction)`) — enum `BulkAction { Publish='publish', Draft='draft', Archive='archive', Restore='restore', SetCategory='set-category' }`
- `categoryId?: string` — required when action is `set-category` (validate in the pure helper).

## Pure logic (TDD — write test first, RED, then implement)

### `product-slug.ts`
```ts
export function slugify(input: string): string
```
lowercase, trim, spaces/underscores → `-`, strip non `[a-z0-9-]`, collapse repeats, trim leading/trailing `-`. Test: `"Vitamin C Serum 30% "` → `"vitamin-c-serum-30"`; `"Aloe   & Neem"` → `"aloe-neem"`; already-slug stays.

### `admin-product-where.ts`
```ts
import type { Prisma } from '@prisma/client';
export function buildAdminProductWhere(dto: {
  q?: string; status?: string; category?: string;
  stock?: 'in'|'out'|'low'; priceMin?: number; priceMax?: number; deleted?: boolean;
}): Prisma.ProductWhereInput
```
- `deleted === true` → `deletedAt: { not: null }`; else `deletedAt: null`.
- `q` → `OR: [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }]`.
- `status` → `status: status`.
- `category` → `category: category`.
- `stock: 'out'` → `stockQty: { lte: 0 }`; `'in'` → `stockQty: { gt: 0 }`; `'low'` → `stockQty: { gt: 0, lte: 5 }` (use the 5 default; a per-product threshold compare needs raw SQL — keep the constant here and note it).
- `priceMin/priceMax` → `priceMinor` gte/lte (× 100).
Test the branch combinations (deleted toggle, q OR, stock buckets, price ×100).

### `bulk-action.ts`
```ts
export function resolveBulkAction(action: string, categoryId?: string):
  | { kind: 'status'; status: 'PUBLISHED'|'DRAFT' }
  | { kind: 'soft-delete'; deletedAt: Date | null }   // Date for archive, null for restore
  | { kind: 'set-category'; categoryId: string }
```
Throw `BadRequestException` when `set-category` has no `categoryId`. (Pass a `now: Date` arg so it stays pure/testable — the caller supplies `new Date()`.) Test each action + the missing-categoryId error.

## Service logic

Inject `PrismaService`. (No InventoryService dependency needed — see create.)

- **adminList(dto)**: `where = buildAdminProductWhere(dto)`; `orderBy` from sort (newest→`createdAt desc`, oldest→`createdAt asc`, price-asc/desc→`priceMinor`, stock-asc/desc→`stockQty`, name→`name asc`); `{ skip, take, page, perPage } = pageArgs(dto)`. Two queries: `findMany({ where, orderBy, skip, take, select: SUMMARY })` + `count({ where })`. SUMMARY select: `id, name, slug, sku, category, priceMinor, compareAtPriceMinor, stockQty, inStock, status, featured, thumbnailUrl, thumbnailAlt, deletedAt, updatedAt`. Return `{ items, total, page, perPage }`.
- **adminGetById(id)**: `findUnique({ where: { id }, include: { gallery: { orderBy: { sortOrder: 'asc' } }, ingredients: true, benefitItems: true, badges: true, skinTypes not a relation (scalar), concerns: { include: { concern: true } }, categoryLinks: { include: { category: true } }, recommendations: { include: { targetProduct: { select: { id, name, slug, thumbnailUrl } } } } } })`. NO deletedAt filter (admin can view archived). Throw `NotFoundException` if null.
- **slugCheck(slug, excludeId?)**: `const hit = await findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } })`; return `{ available: !hit }`.
- **create(dto, actorId)**:
  1. Uniqueness: `findFirst({ where: { OR: [{ slug }, { sku }] } })` → `ConflictException('A product with this slug or SKU already exists.')`.
  2. `stockQty = dto.stockQty ?? 0`.
  3. `prisma.$transaction(async (tx) => { const product = await tx.product.create({ data: { ...scalars, brand: dto.brand ?? 'Wood House Herbals', stockQty, inStock: stockQty > 0, stockStatus: stockQty > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK', tags: dto.tags ?? [], howToUse: dto.howToUse ?? [], benefits: dto.benefits ?? [], skinTypes: dto.skinTypes ?? [], gallery: nestedCreate, ingredients: nestedCreate, benefitItems: nestedCreate, badges: nestedCreate, concerns: { create: concernIds.map(id => ({ concern: { connect: { id } } })) }, categoryLinks: { create: categoryIds.map((id,i) => ({ category: { connect: { id } }, isPrimary: i===0 })) }, recommendations: { create: recs.map(r => ({ targetProduct: { connect: { id: r.targetProductId } }, kind: r.kind ?? 'RELATED', score: r.score ?? 0 })) }, dates: parse saleStartsAt/saleEndsAt/publishAt to Date }, include: {...} }); if (stockQty > 0) { await tx.inventoryMovement.create({ data: { productId: product.id, previousQty: 0, newQty: stockQty, delta: stockQty, reason: 'INITIAL_SEED', actorId, note: 'Initial stock on product creation' } }); } return product; })`. (Direct INITIAL_SEED movement is correct here: a just-created product has no prior stock and no race, so the InventoryService.adjust CAS path — meant for deltas on live stock — doesn't apply. Mid-life stock edits still go through InventoryService.adjust in the Inventory phase.)
- **update(id, dto)**: ensure exists (`findUnique`, else 404). If `slug`/`sku` present, uniqueness excluding self → 409. `$transaction`: for each provided nested array, `deleteMany({ where: { productId: id } })` then recreate (gallery/ingredients/benefitItems/badges/concerns via ProductConcern/categoryLinks via ProductCategoryLink/recommendations); update scalars/arrays/dates. NEVER write stockQty/rating/reviewCount (DTO can't carry them). Return `adminGetById(id)`.
- **softDelete(id)**: ensure exists; `update({ where: { id }, data: { deletedAt: new Date() } })`.
- **restore(id)**: `update({ where: { id }, data: { deletedAt: null } })`.
- **bulk(dto)**: `const resolved = resolveBulkAction(dto.action, dto.categoryId, new Date())`. `$transaction`: apply to `where: { id: { in: dto.ids } }` — status→`updateMany({ data: { status } })`; soft-delete→`updateMany({ data: { deletedAt } })`; set-category→per-id upsert of a primary ProductCategoryLink + set `categoryRefId` (or `updateMany categoryRefId` + ensure a link row). Simplest for set-category: `updateMany({ where, data: { categoryRefId: categoryId } })` AND for each id upsert a ProductCategoryLink `{ productId, categoryId }` with isPrimary true. Return `{ updated: dto.ids.length }`.

## Storefront draft-leak fix (`src/modules/products/products.service.ts`)

- In `list`, add `where.status = 'PUBLISHED'` to the base `where` (before `excludeDeleted`). Only published products show to shoppers.
- In `findBySlug`, add `status: 'PUBLISHED'` to the lookup where (so a draft/scheduled slug 404s on the storefront). Verify the storefront still builds and the 6 seeded products (all PUBLISHED) still return.

## Verification

- `npm run typecheck && npm run build && npm test` green (new pure tests included).
- Manual curl demo (backend on :4000, admin cookie via `POST /api/auth/admin-login` owner@woodhouseherbals.test / Adm1n!Passw0rd#2026):
  - `GET /api/admin/products` → paginated list of the 6 seeded products.
  - `POST /api/admin/products` with a minimal body (name/slug/sku/shortDescription/longDescription/category/priceMinor/thumbnailUrl/thumbnailAlt/stockQty) → 201-ish, returns the created product; verify an INITIAL_SEED InventoryMovement row exists.
  - `GET /api/admin/products/:id` → full record.
  - `PATCH` with `{ stockQty: 5 }` → 400 (rejected); with `{ name: 'X' }` → 200.
  - `DELETE /api/admin/products/:id` then `GET ?deleted=true` shows it; `POST :id/restore` brings it back.
  - `POST /api/admin/products/bulk { ids:[...], action:'draft' }` → `{ updated }`.
  - `GET /api/products` (storefront) still returns only published; the draft created above does NOT appear.
- Commit: `feat(admin): admin-products CRUD, bulk, slug-check endpoints + storefront draft filter`.
