# Admin panel — deferred fast-follows

Tracked items deferred from the Phase B (app shell) final whole-branch review.
None block Phase C from starting. Fix opportunistically or in a dedicated
cleanup pass. Severity is the reviewer's.

**Already resolved (not in this list):**
- Login error handling (was #4) — fixed on `feat/admin-phase-c`
  (`Admin/src/lib/auth-errors.ts` + test; login page now distinguishes
  401 / 403 / 429 / 5xx / network).
- Cookie-domain decision (was #2) — fixed on `feat/admin-phase-c`
  (`COOKIE_DOMAIN` env stamps `Domain` on the auth cookies in prod;
  documented in `Admin/README.md`).

---

## Important

### FF-1 — `/products/new` is a dead 404 wired into the most prominent CTAs
The products page header button, its empty-state button, the command palette
"Add new product" item, and `Cmd+N` all push to `/products/new`, which renders
Next's default 404 *outside* the shell with no way back.
- **Where:** `Admin/src/app/(dashboard)/products/page.tsx`,
  `Admin/src/components/layout/command-palette.tsx`,
  `Admin/src/app/(dashboard)/layout.tsx` (Cmd+N).
- **Fix:** largely resolved by Phase C step 4 (the real Add Product page at
  `/products/new`). Until then, and for any other stray sub-route, add a
  `Admin/src/app/(dashboard)/not-found.tsx` that renders inside the shell with
  a "back to dashboard" link.

### FF-2 — Idle timeout is per-tab, but logout revokes the whole session family
The 30-min idle timer only observes activity in its own tab. With two admin
tabs open, an idle background tab fires `logout`, which revokes the refresh
family server-side and kills the session the user is actively working in
another tab.
- **Where:** `Admin/src/hooks/use-idle-timeout.ts`, consumed in
  `Admin/src/app/(dashboard)/layout.tsx`.
- **Fix:** share a `lastActivityAt` timestamp across tabs via `localStorage`
  (or `BroadcastChannel`); only fire `onIdle` when *all* tabs have been idle
  past the threshold.

---

## Minor

### FF-3 — CI `admin-check` doesn't run the unit tests
The job runs install + soft lint + build; the 7 `node:test` tests only run
locally.
- **Where:** `.github/workflows/ci.yml` (`admin-check` job).
- **Fix:** add a `- name: Test\n  run: npm run test` step after the build.

### FF-4 — Dialog / control accessibility gaps
- The user-menu trigger has no accessible name (SR announces the avatar
  initials, e.g. "OW, button") — add `aria-label="Account menu"`.
  (`Admin/src/components/layout/user-menu.tsx`)
- The mobile-nav `SheetContent` and the `CommandDialog` lack an (sr-only)
  `DialogTitle`, so Radix logs a dev warning and screen readers announce an
  unnamed dialog. Add a visually-hidden title to each.
  (`Admin/src/components/layout/topbar.tsx`,
  `Admin/src/components/layout/command-palette.tsx`)

### FF-5 — `Cmd+N` is a browser-reserved shortcut
Chrome/Edge/Firefox reserve `Ctrl/Cmd+N` for "new window", and
`e.preventDefault()` cannot intercept it, so the shortcut is dead for most
users. The command palette already covers "add product".
- **Where:** `Admin/src/app/(dashboard)/layout.tsx`.
- **Fix:** rebind to a non-reserved combo (e.g. a `g p` sequence or
  `Cmd+Shift+P`), or drop it and rely on the palette.

### FF-6 — `env.ts` silently falls back to `localhost` in production builds
A deploy missing `NEXT_PUBLIC_API_URL` would quietly ship an admin pointing at
`http://localhost:4000`.
- **Where:** `Admin/src/lib/env.ts`.
- **Fix:** throw when the var is unset and `process.env.NODE_ENV === 'production'`;
  keep the localhost fallback for dev only.

### FF-7 — `next@14.2.5` carries a known npm advisory
Pinned to match the storefront. `npm install` warns.
- **Where:** `Admin/package.json` and `Frontend/package.json`.
- **Fix:** bump both apps to a patched `14.2.x` together in one change so they
  stay in lockstep.

### FF-9 — No global Prisma error filter: unique-constraint races surface as 500
The admin-products create/update pre-check slug/SKU with `findFirst` then write
(TOCTOU). A concurrent duplicate, or a `barcode` collision (unique, not
pre-checked), hits Prisma `P2002` inside the transaction and — with no
app-wide `PrismaClientKnownRequestError` exception filter — returns a raw 500
instead of a clean 409. Low-probability on an admin-only panel, but worth a
global filter once the products UI drives more traffic.
- **Where:** app-wide (a new `src/common/filters/prisma-exception.filter.ts`
  registered in `main.ts`).

### FF-10 — Duplicate recommendation pairs throw an unhandled P2002
`admin-products` create/update de-dupe `concernIds`/`categoryIds`, but a
repeated `(targetProductId, kind)` in `recommendations` still hits the
`Recommendation` unique constraint as a 500.
- **Where:** `Backend/src/modules/admin-products/admin-products.service.ts`.
- **Fix:** de-dupe recommendations by `(targetProductId, kind)` in the
  DTO→Prisma mapping (or lean on FF-9's filter).

### FF-8 — `useLogout.onSettled` does a redundant invalidate
It calls `setQueryData(qk.me, null)` (instant) then
`invalidateQueries({ queryKey: qk.me })`, which can trigger a pointless
me → refresh → retry round-trip on the next mount.
- **Where:** `Admin/src/hooks/use-admin-auth.ts`.
- **Fix:** `setQueryData(qk.me, null)` alone is sufficient for instant logout UI.

---

## Phase C step 3 (products list) — deferred from the step-3 review

The step-3 adversarial review confirmed 4 findings; 3 were fixed on
`feat/admin-phase-c` (checkout stock-flag reconciliation folded into
`InventoryService.adjust`; `adjustStockInView` made stock-filter-aware;
pagination page-snap-back). The rest are tracked here.

### FF-11 — Quick stock-adjust sends a delta derived from a possibly-stale current qty (Low)
The dialog presents an absolute "New quantity" but transmits
`delta = target − cachedCurrentQty`. If the product's stock changed since the
list was fetched, the product lands at the wrong absolute quantity (the CAS
guard prevents corruption/oversell, and the ledger records the true delta, but
the admin's intended absolute value is not honoured). Rare on an admin-only
panel; the value self-corrects on the next refetch.
- **Where:** `Admin/src/app/(dashboard)/products/_components/stock-adjust-dialog.tsx`,
  `Backend/src/modules/inventory/{inventory.controller,inventory.service,dto/adjust-stock.dto}.ts`.
- **Fix:** send `expectedQty: target.stockQty` in the adjust body and have the
  service CAS against the client-supplied expected value (409 "Stock changed
  concurrently — please retry" on mismatch), then the dialog refetches and
  shows the new current. Alternatively reframe the control as an explicit
  relative +/- adjustment.

### FF-12 — Category & status list filters are single-select only (Minor)
The step-3 spec called for multi-select category and status filters, but
`GET /admin/products` accepts a single `category` (ProductCategory enum) and a
single `status` (ProductStatus) value, so the UI is honestly single-select.
- **Where:** `Backend/src/modules/admin-products/dto/list-admin-products.dto.ts`
  + `admin-product-where.ts`; `Admin/.../products-filters.tsx`.
- **Fix:** accept `category`/`status` as arrays (`@IsEnum(..., { each: true })`,
  `where.category = { in: [...] }`), then switch the filter chips to multi-select.

### FF-13 — "Set category" bulk action targets the relational Category, not the displayed enum (Minor)
The list's Category column shows the `ProductCategory` enum, but the
`set-category` bulk action assigns the relational `Category` (`categoryRefId` +
`ProductCategoryLink`), which is not shown in this list — so a successful
set-category produces no visible change in the Category column.
- **Where:** `Backend/src/modules/admin-products/admin-products.service.ts`
  (`bulk` set-category branch); `Admin/.../set-category-dialog.tsx`.
- **Fix:** decide the canonical taxonomy for the admin list — either surface the
  relational category (add it to `SUMMARY_SELECT` and show it), or point the
  bulk action at the enum. Until then the dialog notes it assigns the catalog
  category.

---

## Phase C step 4 (Add Product form) — deferred

### FF-14 — Per-ingredient / per-benefit icons (deferred from GROUP 6)
`IngredientItemDto` and `BenefitItemDto` both carry an optional `iconUrl`, but
the Add-Product form's Ingredients & Usage section (GROUP 6) captures only
name + benefit (and benefit text). Per-row icons need a per-row Cloudinary
upload (the media-section signed-upload flow, scoped down to a single small
image) — real complexity for a cosmetic touch, so deferred.
- **Where:** `Admin/.../products/_form/sections/ingredients-section.tsx`
  (+ `_form/ingredients.ts` payload mapping — would add `iconUrl` to the
  ingredient/benefit item shape).
- **Fix:** add an optional icon picker per ingredient/benefit row reusing the
  signed-upload orchestration (`lib/cloudinary-upload.ts`), storing the returned
  `secure_url` as the row's `iconUrl`.

### FF-15 — No optimistic-concurrency on product edit (last-write-wins)
The edit page loads a product then PATCHes the FULL form state back. If another
admin edits the product (or the Inventory module adjusts it) between load and
save, the edit silently overwrites those changes — a lost update. `updatedAt`
is already in the detail response, so a check is feasible.
- **Where:** `Admin/.../products/[id]/edit/page.tsx` (send the loaded
  `updatedAt`), `Backend/.../admin-products/dto/update-product.dto.ts` (add an
  optional `expectedUpdatedAt`), `admin-products.service.ts::update` (compare
  inside the transaction, throw 409 on mismatch).
- **Fix:** carry the loaded `updatedAt` through the form, send it as
  `expectedUpdatedAt`, and 409 "Product changed since you opened it — reload"
  on mismatch; the edit page then offers to reload. Note: `stockQty` is already
  excluded from the update payload, so Inventory-only changes won't false-trip
  it unless they also bump `updatedAt` (they do) — so scope the check to a
  reload prompt rather than a hard block if that proves noisy.

### FF-16 — Optional pricing/text fields cannot be CLEARED on edit (deferred from the whole-branch review)
productFormToUpdatePayload sends explicit `[]` for cleared collections, but for
optional SCALARS (compare-at price, cost, HSN, sale window) it still omits a
blank value, and the backend treats an omitted key as "leave unchanged" — so
those fields cannot be removed once set. A safe fix needs BOTH ends: the frontend
must send `null`, AND buildUpdateData must treat `null` as clear (today
`new Date(null)` corrupts saleStartsAt/saleEndsAt/publishAt to the 1970 epoch),
plus the DTO must not let @IsInt + implicit-conversion coerce `null` to 0.
- **Where:** `Admin/.../_form/to-create-payload.ts` (productFormToUpdatePayload);
  `Backend/.../admin-products.service.ts::buildUpdateData` (date lines ~380/411);
  `update-product.dto.ts` (type the fields `| null`).
- **Fix:** send null for cleared optional scalars; in buildUpdateData do
  `data.saleStartsAt = dto.saleStartsAt === null ? null : new Date(dto.saleStartsAt)`
  (and saleEndsAt/publishAt); confirm compareAt/cost/hsn null clears (not 0).

### FF-17 — Storefront PDP reads deprecated `benefits` scalar; admin writes `benefitItems`
The admin form (GROUP 6) writes the `benefitItems` relation; the storefront PDP
(`products.service.ts::toDetail`) still reads the legacy `benefits` string array,
so admin-entered benefits never appear on the PDP. Not a live regression (the
storefront is still largely on mock data) but a gap to close when the PDP goes live.
- **Where:** `Backend/src/modules/products/products.service.ts` (findBySlug
  include + toDetail ~line 158).
- **Fix:** include `benefitItems: { orderBy: { sortOrder: 'asc' } }` and map
  `benefits: p.benefitItems.map((b) => b.text)` (fall back to the legacy scalar
  for un-migrated rows).

---

## Phase D1 (admin-orders) — deferred from the D1 adversarial review

### FF-18 — `cancel()` restock cost grows linearly with line-item count (Low)
`AdminOrdersService.cancel` restocks each line with a separate
`InventoryService.adjust` (3 sequential queries/line). On Neon's high-latency
link a very large order (dozens of lines) could approach the 20s
`ADMIN_WRITE_TX_TIMEOUT_MS` and become uncancellable. Realistic orders (a handful
of lines) are well within budget, so this is deferred — but if bulk/wholesale
orders appear it should be made set-based.
- **Where:** `Backend/src/modules/admin-orders/admin-orders.service.ts::cancel`.
- **Fix:** inside the tx, one `findMany` of `{id, stockQty}` for all line
  products, one bulk `UPDATE ... stockQty = stockQty + delta` (a cancel restock
  is a positive delta and can't violate `stockQty >= 0`, so the per-row CAS isn't
  needed here), reconcile `inStock`/`stockStatus` flags, and one
  `inventoryMovement.createMany` for the audit rows — cost independent of line count.

---

## Phase D3 (order detail + GST invoice + refund UI) — recorded at design time

### FF-19 — Credit notes for refunds (Medium, GST-compliance)
D3 v1 ships GST tax invoices but NOT credit notes. GST-proper refund
documentation is a **credit note**: its own numbered document that references the
original invoice number and records the reversed tax. A REFUNDED order's original
invoice stays immutable (correct); the credit note lands as a follow-up.
- **Where:** new alongside `Backend/src/modules/invoices/` — a `CreditNote` model
  (own FY number series referencing `Invoice.number`), generated on a settled
  refund, rendered like the invoice.
- **Why deferred:** invoices are the launch blocker; credit notes are needed
  before the first refund is filed on a GST return, not before go-live.

### FF-20 — GST state-code enum (Low, removes place-of-supply ambiguity)
The invoice place-of-supply split (CGST/SGST vs IGST) matches buyer vs store
state by **normalized free-text compare** with an `ambiguousPlaceOfSupply` flag.
Replacing free-text state with canonical GST state codes removes the ambiguity.
- **Where:** `Backend/src/modules/invoices/invoice-tax.ts` (state match) + wherever
  `Order.shippingState` is set.
- **Fix:** a `GstStateCode` enum + a name→code resolver; drop the ambiguity flag.
- **Paired with the storefront backlog item below (fixes it at the source).**

### BACKLOG (storefront) — state dropdown at checkout
`Order.shippingState` is free text today, which forces the invoice's fuzzy
place-of-supply match. A checkout **state dropdown keyed by GST state codes**
kills the ambiguity at the source (and enables FF-20 cleanly).
- **Where:** storefront checkout address form + the order-create DTO.

### FF-21 — Invoice letterhead styling pass (Low, cosmetic)
The D3 GST invoice PDF renders as plain functional columnar text (pdfkit) — the
numbers are unambiguous, which is what the T11 legal review needed, but it's not
a designed document. A styling pass (logo/letterhead, bordered line table,
right-aligned amounts, footer) would make it customer-facing-polished.
- **Where:** `Backend/src/modules/invoices/invoice-pdf.ts` (render only).
- **Note:** LOGIC UNTOUCHED — the immutable snapshot + tax math don't change; this
  is purely how `renderInvoicePdf` draws the snapshot. Safe, isolated.

### FF-22 — PhonePe auto-cancel movements don't resolve an order link (Low)
`phonepe.service.ts` sets the restock movement's `reference` to the order *id*
(cuid), while every other order flow uses the order *number*; the inventory
history resolves links against `Order.number`, so a payment-failure auto-cancel's
restock shows "—" (no link) instead of its order. No WRONG link (a cuid can't
collide with a `WH-…` number) — just a missing one.
- **Fix:** pass `reference: order.number` (or set the movement's `orderId` column
  and have `InventoryService.adjust` accept + write it) in the PhonePe callback.

### FF-23 — Testimonial rating can't be CLEARED on edit (same class as FF-16)
`TestimonialDialog` maps a "None" rating selection to `rating: undefined`, and the
content service treats an omitted key as "leave unchanged" — so once a testimonial
has a star rating you can't remove it via the editor. Same optional-scalar-clear
limitation FF-16 describes; deferred for consistency. Low impact (rating is
optional decoration on a homepage quote).
- **Where:** `Admin/.../content/_components/testimonial-dialog.tsx` (submit);
  `Backend/.../admin-content/admin-content.service.ts::updateTestimonial`;
  `admin-content/dto/content.dto.ts` (UpdateTestimonialDto rating).
- **Fix:** send `rating: null` on clear; type the DTO field `number | null` and
  set `data.rating = dto.rating` when the key is present (null clears).

### FF-24 — Content reorder/toggle have no optimistic cache update (Low, polish)
`use-content.ts` reorder mutations only `invalidateQueries` on settle, and the
active/published Switch handlers mutate without touching the cache — so on a slow
network a dragged row snaps back to its old slot (and a toggled Switch flips back)
for the request round-trip until the refetch lands. NOT a Section-4 regression:
the categories feature (`use-admin-categories.ts` reorder + tree toggle) has the
exact same gap, so this is a shared polish pass, not new debt.
- **Where:** `Admin/src/hooks/use-content.ts` (useReorder + the tab Switch
  handlers); same treatment would apply to `use-admin-categories.ts`.
- **Fix:** `onMutate` → cancelQueries + setQueryData (optimistic reorder/flag) with
  an `onError` rollback; keep the settle-invalidate as the reconcile.

### FF-25 — ContentImageField duplicates categories' ImageUploadField (Low, DRY)
`content/_components/content-image-field.tsx` is a near-verbatim superset of
`categories/_components/image-upload-field.tsx` (adds `folder` + `aspect` props).
Both also LACK delete-on-remove Cloudinary cleanup (the product media section has
it), so a removed/replaced banner or category image is orphaned in Cloudinary.
- **Where:** the two field components above.
- **Fix:** promote the parameterized field to `Admin/src/components/common/` and
  have both features consume it; fold in delete-on-remove (call
  `api.uploads.delete(publicId)` on remove/replace of a just-uploaded asset) while
  the code is unified.

## Coupon-redemption enforcement gaps (each is its own money-path phase)
The §5 Coupons admin is scoped to what `CouponsService.preview`/`redeem` actually
enforces (PERCENT/FLAT + category restriction + usage caps + schedule). The
`Coupon` model carries more columns that the redeem path ignores; the admin DTOs
REJECT them (400) rather than persist dead config. Enforcing each is deferred —
and because it touches the ATOMIC redeem/pricing path, each is its own specced
phase with money-grade TDD + review, NOT a rider on a CRUD change.

### FF-26 — Coupon eligibility (FIRST_TIME / SPECIFIC) + CouponUser targeting
`Coupon.eligibility` and the `CouponUser` join are enforced nowhere: `preview`
checks `active`/dates/`maxUses`/`perUserLimit` but never `eligibility` or whether
the user is in `coupon.users`. A "first-time only" or "specific-users" coupon
would today apply to everyone.
- **Requires:** its own phase touching `coupons.service.ts::preview`/`redeem`
  (needs the customer's prior-order count for FIRST_TIME, and a `users` membership
  check for SPECIFIC), money-grade review. Then re-admit the fields to the admin DTO.

### FF-27 — Coupon concern / product restriction
`applicableSubtotal` only honors the CATEGORY restriction; `CouponConcern` and
`CouponProduct` (incl. the `excluded` flag) are ignored. Worse, a concern-ONLY
coupon (no categories) currently computes applicableSubtotal = 0 and always fails.
- **Requires:** plumb the line's concern ids + product id through `PreviewInput.lines`
  and extend `applicableSubtotal` to honor concern/product scope + exclusions;
  money-grade review. Then re-admit `concernIds`/`productIds` to the admin DTO.

### FF-28 — FREE_SHIPPING / BXGY discount kinds
`computeDiscount` implements only PERCENT/FLAT; FREE_SHIPPING and BXGY fall through
to FLAT math (wrong discount). FREE_SHIPPING needs the shipping amount in the
pricing scope; BXGY needs line-level buy/get logic (`buyQty`/`getQty`).
- **Requires:** its own phase extending `coupon-pricing.ts` + the order-pricing
  shipping wiring, TDD + money-grade review. Then re-admit those kinds to the
  admin DTO's `@IsIn`.
