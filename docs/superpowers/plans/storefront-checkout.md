# Storefront Checkout Path — Implementation Plan

> **Status: DESIGN — reviewed, awaiting final approval. No implementation code in this document by design.**
> **For agentic workers:** REQUIRED SUB-SKILL at execution — superpowers:subagent-driven-development (per task) or superpowers:executing-plans.
> Basis: the 2026-07-13 cart→order recon (5-tracer sweep, cited inline as `file:line`). Provider facts (Razorpay checkout.js) reuse the verified Appendix B of `razorpay-migration.md`. **Fact-checked (Next.js 14 / react-query / checkout.js docs + codebase) and adversarially reviewed (15 findings, 6 HIGH — all folded in, marked `CP5-review` inline).** Amendments 1–4 applied.

**Goal:** Make the Woodhouse storefront able to place a real, paid order — connect the client cart to the backend cart, build the missing `/checkout` page end to end (cart review → address → Razorpay → result), and first make the catalog live so cart product ids actually exist in the database.

**Architecture:** The backend is already complete and authoritative (Razorpay phases 0–7): `/cart`, `/orders`, `/razorpay/{initiate,verify,webhook}` all exist and re-price everything server-side. The storefront gap is threefold — the catalog is 100% static mock (so cart ids are fake), the client cart never touches the backend cart the order path reads, and there is no checkout page. This plan closes all three, with the catalog fix as the keystone that must land first.

**Tech stack:** Next.js 14 (App Router), React 18, Zustand + `persist`, `@tanstack/react-query` (already a dep, already used by `useCatalog`/SmartSearch), the existing `Frontend/src/lib/api.ts` client (`credentials:'include'`), Razorpay checkout.js (`https://checkout.razorpay.com/v1/checkout.js`).

## Decisions locked (build to these)

1. **Cart sync: Option A (sync-on-mutation).** Every add/remove/setQuantity calls the matching `/cart` endpoint; Zustand becomes an optimistic **cache** of the authoritative server response. This mints `wh_sid` early — mandatory, because `cart.controller.ts::ensureSession` (~`:72`) is the **only** `wh_sid` minter and both `POST /orders` (`orders.controller.ts:41-42`) and `POST /razorpay/initiate` (`razorpay.controller.ts:44-48`) hard-fail without it.
2. **Guest-cart merge-on-login: DEFERRED** (fast-follow). Guest checkout works; no new auth surface now.
3. **Cart TTL / GC: DEFERRED** (fast-follow). ⚠ Guard for whoever builds it: **never GC a cart tied to a non-terminal order** (an order in `PENDING`/`PAID`/`PROCESSING`/`SHIPPED` — `cartSessionId` is the settlement's clear key and the guest's ownership key).
4. **Checkout reconciliation UX: IN SCOPE — launch blocker.**
5. **Cleanup** (dead `/checkout` links, PhonePe copy): folded in.

## Global constraints

- Money is integer paise; the storefront never computes an authoritative total. **THE TRAP (see Phase 5): checkout POSTs ONLY `{ shipping address, couponCode }` — never client prices, totals, or line items.** The server re-prices from live `Product.priceMinor` (`orders.service.ts:88-91`).
- `credentials:'include'` on every storefront fetch (already the default in `api.ts:44,68`) — the `wh_sid` guest-cart cookie must round-trip.
- New client API methods follow the existing `api.ts` shape (`apiGet`/`apiSend`); catalog/homepage reads follow the existing `useCatalog` pattern (react-query + `withFallback` + `initialData`).
- Commit style: author Shivanshu, no Claude attribution.
- Do not restructure the backend — it is complete and reviewed. This plan is Frontend-only except one CORS line (Phase 2).

---

## ⚠ First-class design item: mock-fallback is a PRODUCTION HAZARD (amendment 2)

The existing `useCatalog` is **live-preferred with silent mock fallback** (`withFallback(() => api.products(), () => productSummaries)` + `initialData: productSummaries`). That is a safety net for a mock-only storefront, but once the catalog is real it becomes a **liability**: an API outage doesn't fail the storefront, it **silently serves phantom products** — fake ids that 404 on `POST /cart/items`, fake prices shown to real customers, and it **resurrects the exact `p_acne_facewash` phantom this phase deletes**. A customer could see, add, and try to buy a product that does not exist.

**Design rule (launch-blocking): in production, an API failure surfaces an honest error/empty state — NEVER mock data.**

**Mechanism — recommended: DELETE the mock, don't gate it.** Env-gating (serve mock only when `NODE_ENV!=='production'`) leaves a code path that a misconfigured env can ship to customers. The only fallback that *cannot* be accidentally served is one that *does not exist*. So, as part of the keystone:
- **Delete `Frontend/src/data/products.ts`** once the catalog is live.
- **Strip the fallback + `initialData`** from `useCatalog` (and the new `useHomepage`): `queryFn: () => api.products().then(r => r.items)` with NO mock cushion. Expose react-query's `isLoading` / `isError` / empty so components render a skeleton on first paint and an **honest error/empty** on failure (no phantom rows).
- **Blast radius of deleting `products.ts`** (measured — amendment 3): two other mock modules chain off it and are deleted WITH it because their live replacements exist:
  - `Frontend/src/data/homepage.ts` `import { productSummaries }` — dead once the homepage consumes `api.homepage()` (K3). The live `/homepage` payload (`homepage.service.ts:33-45`) returns exactly `{ offerStrip, hero, concerns, bestsellers, newArrivals, comboPacks }` — full parity with the mock. **Delete `homepage.ts`.**
  - `Frontend/src/data/bestsellers.ts` `import { products, productSummaries }` — bestsellers are in the live homepage payload (`bestsellers` field). **Delete `bestsellers.ts`.**
  - `Frontend/src/data/concerns.ts` is **standalone** (imports only the `ConcernCard` type) and carries **concern category cards, NOT phantom products** — so it is NOT the hazard. Keep it for now (imported by `SmartSearch.tsx` + the dead `homepage.ts`); migrating SmartSearch's concern source to the live payload is a fast-follow.
- **Cost of deletion:** the catalog and homepage lose their offline cushion — a backend outage shows an error/empty state instead of a stale-but-rendered page. That is exactly the intent: honest failure beats fictional prices. First-paint gains a loading skeleton (no `initialData` seed); pre-fetching the shop server-side to skip the skeleton is a polish fast-follow, not a blocker.
- **Pinning test (launch-blocker):** with `api.products()`/`api.homepage()` mocked to REJECT, the shop/homepage render an error/empty state and **zero mock/phantom rows** — assert no product with a `p_*` mock id or a mock price ever appears. A regression guard that fails if a mock-catalog import is re-introduced into `useCatalog`/`useHomepage`.

## THE KEYSTONE — Phase 1: catalog goes live (sequence FIRST)

**Why it must be first.** The storefront catalog is 100% static mock: `Frontend/src/data/products.ts` with ids like `p_acne_facewash`. The client cart copies these ids into its lines (`store/cart.ts:36`). The moment the cart calls `POST /cart/items` (Phase 3), the backend does `product.findFirst({ where: { id: dto.productId, status:'PUBLISHED' } })` (`cart.service.ts:26-28`) and **404s "Product not found"** because `p_acne_facewash` is not a real DB cuid. So checkout is impossible until the catalog serves real DB products. Nothing downstream works without this.

**What it unblocks (name these explicitly in the phase's done-note):**
- **(a) Tier-1 Cloudinary images** are already wired into `Backend/prisma/seed.ts` but invisible — the storefront reads `products.ts`, not the DB. Going live surfaces them.
- **(b) FF-2 — the `p_acne_facewash` "salicylic" phantom** exists ONLY in `products.ts:56-60` (`slug: anti-acne-salicylic-face-wash`) and dies with it. **Mark FF-2 resolved** when `products.ts` is no longer the catalog source.
- **(c) New SKUs added via Admin** become visible on the storefront at all (today the Admin writes the DB; the storefront never reads it).

### What already exists (do not rebuild)

- `Frontend/src/hooks/use-catalog.ts` — a react-query hook that **already** prefers `api.products()`; it currently falls back to `productSummaries` with an `initialData` mock seed. **It is only consumed by SmartSearch today.** The work is to (a) route the shop/PDP/other surfaces through it (and a sibling homepage hook), and (b) **strip its mock fallback + `initialData`** per the production-hazard rule above — not to invent fetching.
- `api.products(query?)` → `GET /api/products` → `{ items: ProductSummary[] }` (`api.ts:94`; backend `products.service.ts:56` returns `toSummary`). Server-side filtering exists (`ListProductsDto`: category/skinType/concern/minRating/price — `products.service.ts:15-36`).
- `api.product(slug)` → `GET /api/products/:slug` → `{ product: ProductDetail, recommended: ProductSummary[] }` (`api.ts:96`; `products.service.ts:92`).
- `api.homepage()` → `GET /api/homepage` → `HomepagePayload` (`api.ts:93`).
- `withFallback(live, fallback)` (`api.ts:148-157`) — the transparent live-or-mock wrapper.

### The mock-import inventory (every surface to migrate)

Direct importers of `@/data/products` (recon-confirmed): `components/shop/ShopGrid.tsx`, `app/shop/[slug]/page.tsx` (the PDP), `components/home/CategoryBar.tsx`, `app/account/wishlist/page.tsx`, `app/ai/skin-analysis/page.tsx`, and `hooks/use-catalog.ts` (as the fallback — keep). Derived mock that also chains off `products.ts`: `data/bestsellers.ts` and `data/homepage.ts` both `import { productSummaries }`; `data/concerns.ts` is standalone. Homepage components (`NewArrivals`, `OfferStrip`, `TrustStrip`, `ShopByConcern`, `ComboPacks`) import `@/data/homepage`.

### Tasks

**K1 — `useCatalog` becomes the single catalog source for the shop grid.**
- `ShopGrid.tsx` (`:8,17`): replace `import { productSummaries }` + `filterAndSort(productSummaries, …)` with `filterAndSort(useCatalog(), …)`. `filterAndSort`/`parseShopQuery` (`lib/shop-query.ts`) stay — filtering remains client-side over the fetched list (the catalog is small; server-side filter params are a fast-follow, not needed for MVP).
- Add **loading / error / empty** states: `useCatalog` seeds `initialData` so first paint is never blank, but add an explicit empty-state ("No products match") and — because `withFallback` swallows errors into the mock — a small non-blocking "showing cached catalog" indicator is a fast-follow, not a blocker.
- Test: unit-test that ShopGrid renders from a mocked `useCatalog` return, and that an empty filtered result shows the empty state.

**K2 — the PDP goes live (the meatier one: server component + `generateStaticParams`).**
- `app/shop/[slug]/page.tsx` is a **server component** with `generateStaticParams()` that pre-renders every MOCK slug and `findProductBySlug` from the mock. A new SKU (or any DB-only product) would 404 until rebuild.
- Convert to a live server fetch: the RSC calls `api.product(slug)` **server-side**. `/api/products/:slug` is `@Public` (no cookie needed), so a plain server `fetch` works; do NOT reuse the browser `api.ts` client blindly if it assumes `window`/cookies — use a server-safe fetch to `${API_URL}/api/products/:slug`. On not-found → `notFound()`.
- Use **`export const dynamic = 'force-dynamic'`** (APPROVED, amendment 1): remove `generateStaticParams`; the RSC renders live per request (Next.js 14 `dynamic='force-dynamic'` = per-request render + uncached fetch — fact-check confirmed; it does not break Client-Component children). A just-added or just-edited SKU (price/stock) is instantly correct — no stale PDP. ISR-with-**on-demand** revalidation is the fast-follow if PDP latency bites (revalidate the specific slug from an Admin write). *Framing note (fact-check): under ISR a brand-new slug is served on-demand at first request too; `revalidate` gates staleness of EDITS to existing PDPs and the shop grid — so force-dynamic's win over ISR is "instantly-correct edits + no grid staleness," not "new SKUs are invisible under ISR."*
- **The `recommended` array is also live (CP5-review MEDIUM):** `app/shop/[slug]/page.tsx:39-45` builds `recommended` by filtering **mock** `productSummaries` and passes it to `<Recommended>` → `ProductCard` (add-to-cart with mock ids). `api.product(slug)` already returns a **live** `recommended: ProductSummary[]` (`products.service.ts:92`). Pass the live `recommended` from the payload and **delete the local mock computation** — otherwise the PDP's recommended cards 404 at checkout.
- **No mock fallback on the PDP** (production-hazard rule): backend-down → `notFound()` or an honest error boundary, never a bundled/phantom product. A fictional PDP a customer can add to cart is the exact hazard being removed.
- Test: PDP renders from a mocked live product; unknown slug → 404; backend-down → error/not-found (NOT a mock product).

**K3 — homepage goes live via a `useHomepage` hook (parallel to `useCatalog`).**
- Create `hooks/use-homepage.ts`: react-query over `api.homepage()`, **no mock fallback, no `initialData`** (production-hazard rule) — `isLoading` → skeleton, `isError` → honest error state. The live `/homepage` payload (`homepage.service.ts:33-45`) returns exactly `{ offerStrip, hero, concerns, bestsellers, newArrivals, comboPacks }` — full field parity with the `HomepagePayload` type (`types/api.ts:4`), so it fully replaces `data/homepage.ts` and `data/bestsellers.ts`.
- **Route EVERY homepage surface through it — the full list (CP5-review found the enumeration was incomplete):** `NewArrivals`, `OfferStrip`, `TrustStrip`, `ShopByConcern`, `ComboPacks`, **`BestSellerCarousel` (`components/sections/BestSellerCarousel.tsx:5`) and `BestsellerCard` (`components/ui/BestsellerCard.tsx`)**. ⚠ **`BestsellerCard` HAS an add-to-cart** (`:84` → `addToCart({ product: product.summary, quantity: 1 })`) whose `product.summary` is a **mock** `ProductSummary` with a `p_*` id (`data/bestsellers.ts:49`). If the carousel is not migrated, every bestseller "Add" fires `POST /cart/items` with a mock id and **404s at checkout** — this is a money-path break, not cosmetic. The carousel/card must source their product (and its id) from `useHomepage().bestsellers` (live DB ids).
- `CategoryBar.tsx` uses `@/data/products` for category counts — route through `useCatalog`.
- **Delete `data/homepage.ts` and `data/bestsellers.ts`** in this task (they are the phantom-product-carrying mocks that chain off `products.ts`). Keep `data/concerns.ts` (standalone concern cards, not a product hazard; SmartSearch's use of it is a fast-follow).
- Test: homepage components render from a mocked `useHomepage`; the mocked-reject case renders error/empty with zero phantom rows (shared with the hazard pinning test).

**K4 — every add-to-cart entry point + the hardcoded `/shop/${slug}` links.**
- **Enumerate EVERY add-to-cart caller (grep `addToCart`/`useCartStore.*add`) and confirm each sources its product — and thus its id — from a LIVE product.** A missed one seeds a mock id and 404s at checkout. Confirmed callers: `ProductBuyBox.tsx` (PDP — live via K2), `ProductCard.tsx:79,114` (used by ShopGrid grid → live via K1; used by the wishlist → see below), `BestsellerCard.tsx:84` (→ live via K3), `ComboPacks.tsx`. Audit is a completeness gate, not a rewrite, for surfaces already on live data.
- **The `/shop/${slug}` links** (`ai/skin-analysis/page.tsx`, `cart/page.tsx`, `shop/page.tsx`, `ComboPacks.tsx`, `ProductCard.tsx`, `SmartSearch.tsx`, `Hero.tsx`, `BestsellerCard.tsx`) are FINE **as long as `slug` comes from a live product** — the PDP resolves it live (K2). Audit each source; no rewrite for already-live surfaces.
- **`app/account/wishlist/page.tsx` is IN SCOPE — NOT deferrable (CP5-review HIGH).** It renders `ProductCard` (which has add-to-cart) and filters `@/data/products` by id (`:24`), while the wishlist is SAVED by live `product.id` (`ProductCard.tsx:63-66` `toggleWishlist`). Post-keystone the saved ids are DB cuids and the mock filter (`p_*` ids) **never matches** → saved items vanish from the wishlist AND any "add" from a stale mock card 404s. Route the wishlist through `useCatalog` (live product lookup by DB id). Deleting `products.ts` (K5) forces this — the import won't resolve.
- **`app/ai/skin-analysis/page.tsx`** imports mock `productSummaries` for `/shop/:slug` links (`:168`); it has **no** add-to-cart (not a 404-money-path), but a recommended **mock-only slug (e.g. the FF-2 `anti-acne-salicylic-face-wash` phantom) becomes a dead link** once the PDP is live. Route its product source through `useCatalog` too (small; folded here so `products.ts` can be deleted cleanly). If genuinely out of the checkout path it may slip to a fast-follow, but it must be migrated before `products.ts` is deleted or the build breaks — so do it here.

**K5 — delete `products.ts` + verify the catalog is genuinely live.**
- **Delete `Frontend/src/data/products.ts`** (with `homepage.ts`/`bestsellers.ts` from K3). After the K1–K4 migrations there is no remaining importer; a build failure here means a surface was missed (good — it forces completeness). Confirm `grep -rl "@/data/products" src` returns nothing.
- Live-verify: with the backend running against a seeded DB, the shop grid, a PDP, and the homepage all render **DB products with Cloudinary images**, and the `anti-acne-salicylic-face-wash` slug is **gone** (FF-2 dead — mark it resolved). Add a SKU via Admin → it appears on the storefront without a rebuild (proves force-dynamic/live).
- Verify the hazard is closed: with the backend stopped, the shop/PDP/homepage show honest error/empty states — **no phantom products**.
- ⛔ **CHECKPOINT CP-K:** show the human the live storefront (screenshots) + FF-2-gone + Admin-SKU-appears + backend-down-shows-honest-error proofs before proceeding. This phase is the foundation; a wrong catalog source poisons everything after it.

---

## Phase 2: CORS — unblock the order POST (latent bug, tiny)

`app.setup.ts:91` sets `allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']`. `POST /api/orders` reads the **`Idempotency-Key`** header (`orders.controller.ts:39`), and the storefront/api split is cross-origin (storefront ↔ `api.` subdomain). A cross-origin request carrying `Idempotency-Key` triggers a preflight that the server rejects because the header isn't in the allow-list — the POST fails before it runs.

- **Task 2.1:** add `'Idempotency-Key'` to `allowedHeaders` in `app.setup.ts:91`. (Backend change — the only one in this plan.)
- Test: an integration assertion (extend the existing Razorpay integration harness) that an `OPTIONS` preflight for `POST /api/orders` with `Access-Control-Request-Headers: idempotency-key` responds with that header allowed. This is a **money-adjacent latent bug** — pin it.
- ⚠ **O2 — cookie topology is a CUTOVER DEPENDENCY, not a design assumption (amendment 4).** The deploy target is **Coolify/Traefik on a Hostinger VPS (Mumbai), NOT Railway+Vercel**, and the final domain scheme is **not yet decided** — so whether storefront↔api end up same-site or cross-site is undetermined. Do NOT design against an assumed topology (the exact mistake the Razorpay plan made assuming Railway). `wh_sid` is minted `SameSite=lax` (`cart.controller.ts:74`). Two branches, resolved at cutover:
  - **Same-site** (storefront + api share a registrable domain, e.g. `woodhouseherbals.com` + `api.woodhouseherbals.com`): `SameSite=lax` works as-is — cross-origin-but-same-site subrequests send lax cookies.
  - **Cross-site** (different registrable domains): `wh_sid` MUST become `SameSite=None; Secure`, or the guest cart cookie is dropped on the storefront→api XHR and every `/cart` call mints a fresh empty cart. This is a **backend change gated on the domain decision**, and it **must be tested end-to-end on the real topology** (a cross-site guest completes add→checkout→pay with the cookie surviving).
  - The plan does not pick a branch; it records the dependency and requires the cross-site cookie behavior to be verified before launch.

---

## Phase 3: cart sync-on-mutation (Option A)

The client cart becomes an **optimistic cache** of the authoritative backend cart. Zustand still drives instant UI; every mutation fires the matching `/cart` call and reconciles from the response.

### New client API methods (`api.ts`, following `apiGet`/`apiSend`)

- `api.cart.get()` → `GET /cart`
- `api.cart.addItem({ productId, quantity })` → `POST /cart/items`
- `api.cart.setQuantity(productId, quantity)` → `PUT /cart/items/:productId`
- `api.cart.clear()` → `DELETE /cart`

All return the backend `toResponse` shape (`cart.service.ts:84-105`: `{ id, lines, subtotal, discount, shipping, total, itemCount }`). ⚠ **Shape reconciliation:** the backend cart line is `{ productId, slug, name, thumbnail, unitPrice, quantity, lineTotal }` (`cart.service.ts:85-93`) — matches the client `CartLine` (`types/cart.ts:5-13`). Confirm field-for-field; the server response becomes the store's `lines`.

⚠ **`apiSend` plumbing (CP5-review LOW):** `apiSend`'s method union is `'POST' | 'PATCH' | 'DELETE'` (`api.ts:62`) — it does **not** include `PUT`, and `PUT /cart/items/:productId` is the setQuantity route (`cart.controller.ts:44`). Widen the union to include `'PUT'` (one-line change) before writing `api.cart.setQuantity` — "reuse the existing shape" needs this small extension.

### Store rework (`store/cart.ts`)

- **`remove` semantic:** the backend has no dedicated "remove" route — removal is `setQuantity(productId, 0)` (`cart.service.ts:63-64` deletes the line). Client `remove(productId)` calls `api.cart.setQuantity(productId, 0)`. (`PUT /cart/items/:productId` with `quantity:0` is valid — `UpdateCartLineDto` allows `@Min(0)`.)
- **Optimistic + reconcile-to-latest-server, NOT rollback-to-snapshot (CP5-review HIGH — this was a real concurrency bug in the draft):** apply the Zustand change immediately, fire the API call, and on **every** settle (success OR failure) reconcile to the **latest authoritative server state**, never to a stale pre-mutation snapshot. The draft's "roll back to the pre-mutation snapshot" clobbers a concurrent success: qty 2 → click + (R1=set 3) → click + (R2=set 4); R2 succeeds (server=4), then R1 fails → rolling back to snapshot {2} shows 2 while the server holds 4. The correct rule:
  - **Per-line request sequencing / last-write-wins by issue order:** tag each mutation with a monotonically increasing sequence number per productId; a response only updates the store if it is the newest issued for that line (drop stale in-flight responses).
  - **On failure, do NOT restore a local snapshot — re-fetch `GET /cart`** (server truth) for that line, or drop the failed optimistic delta and keep the last reconciled server state. A toast ("Couldn't update your cart") + the authoritative refetch, never a local guess.
  - **Debounce the cart-page stepper** (send only the settled value after a short pause) so rapid clicks collapse to one absolute `setQuantity` — this removes the non-commutative PUT reorder-race (CP5-review MEDIUM: `setQuantity` is an absolute write, `cart.service.ts:66-69`, so two racing PUTs can lose an update by network arrival order; the increment `addItem` path IS commutative and self-converges, but the stepper uses `setQuantity`).
- **`add` merge vs increment:** the backend `POST /cart/items` uses `quantity: { increment }` (`cart.service.ts:48`). The client optimistic add must mirror increment semantics, then reconcile to the server total (the re-cap at `cart.service.ts:53-56` clamps to 20). Do NOT send absolute quantities to the add endpoint expecting replace — a double-fire would double-add. (Prefer `setQuantity` for the cart page's stepper; reserve `addItem` for the PDP "add to cart".)
- **Reads:** on cart-page mount and app load, `api.cart.get()` hydrates the store from the server (the source of truth). On conflict, **server wins**.
- **⚠ The one-time migration wipe (CP5-review MEDIUM — the draft would silently lose a pre-launch cart):** a user who used the site before this phase has a localStorage `wh-cart` full of **mock ids** and **no `wh_sid`**. On first Option-A load, `api.cart.get()` mints a fresh **empty** server cart → server-wins would wipe their visible cart with no notice. A flush-merge can't rescue it either — the stored ids are dead mock ids (`p_*`) that 404 on re-add. So the migration is **explicit: on first Option-A load, detect a pre-existing local cart with no `wh_sid` (or with `p_*` ids) and CLEAR it, with a one-time notice ("Your cart was reset for our new checkout").** The mock-id carts are worthless post-keystone; clearing them is correct, but it must be a deliberate, notified step — not a silent server-wins wipe.
- **`persist` stays** (localStorage `wh-cart`) as an optimistic offline cache only — never authoritative; a fresh `api.cart.get()` overwrites it (after the one-time migration clear).

### Failure modes to design for (each a task or an explicit accepted-degradation note)

- **A mutation API call fails** (network/500): roll back the optimistic change, toast, keep the last known-good server state. The cart is never left showing a state the server rejected.
- **Cookies disabled:** `ensureSession` can't persist `wh_sid` → every `/cart` call mints a fresh empty cart → the cart appears to reset. **Detection must be causally paired (CP5-review LOW):** a plain "`get()` returns empty" is NOT a cookies-off signal — a brand-new visitor or a user who emptied their cart also gets an empty `get()` (false positive). The reliable signal: immediately after a **known-successful `add()`** (whose response contains the added line), an immediate follow-up `get()` that comes back **empty** proves the cookie didn't persist. Show "Enable cookies to use your cart" only on that paired signal. Accepted degradation, not a blocker.
- **Two tabs / double-add race:** since the server response is authoritative and add is increment-based, concurrent adds converge to the summed server total; the last `get()` reconciles both tabs. No corruption (server is the CAS).
- **Price/stock drift:** the cart snapshot price is display-only; irrelevant to money (Phase 5). Stock is only enforced at order-create — surfaced in Phase 4.

- Test: store unit tests with a mocked `api.cart.*` — optimistic apply → server-reconcile replaces lines; failed mutation rolls back; `remove` calls `setQuantity(…,0)`; add mirrors increment then reconciles to the capped server total.
- ⛔ **CHECKPOINT CP-3:** demo add/remove/setQuantity round-tripping to a real backend cart (a `wh_sid` cookie appears; `GET /cart` reflects the mutations); show a forced-failure rollback.

---

## Phase 4: the `/checkout` page (greenfield) + reconciliation UX

There is **no** `/checkout` route today (only dead links at `cart/page.tsx:117`, `Footer.tsx:17`). Build it as `app/checkout/page.tsx` (+ components). The flow:

```
/cart  →  [Proceed to checkout]
/checkout:
  1. RECONCILED CART REVIEW  — GET /cart (server-authoritative); show the reconciled
     lines + server subtotal/shipping. Surface every change vs the client cart
     (removed / out-of-stock / price-changed / quantity-capped). ACK gate.
  2. SHIPPING ADDRESS FORM    — reuse the CreateOrderDto field rules (fullName, phone,
     Indian mobile/pincode regex, address char allow-list). Logged-in users: prefill
     from saved addresses (api.customer.* exists); guests: blank form.
  3. [Place order]  → POST /api/orders { ...address, couponCode }  (Idempotency-Key
     header — a stable client-generated key per checkout attempt so a retry replays
     the same order, orders.service.ts:56-62). Returns the order { number, ... }.
     ⚠ THE RACE (see below): this can STILL 400/409 even after review.
  4. POST /api/razorpay/initiate { orderNumber }  → { keyId, razorpayOrderId, amountMinor,
     currency, orderNumber }.
  5. checkout.js opens with { key: keyId, order_id: razorpayOrderId, amount, currency,
     name: 'Wood House Herbals', handler: (resp) => {...} }.  ← `handler` is itself a
     required option (the fact-check flagged the draft omitted it); it receives
     { razorpay_payment_id, razorpay_order_id, razorpay_signature }. With order_id
     present, Razorpay derives the charge from the SERVER-side order (authoritative);
     amount/currency are still passed for display.
  6. POST /api/razorpay/verify { orderNumber, razorpayOrderId, razorpayPaymentId,
     razorpaySignature }  → the server re-fetches the payment (authority) and settles.
  7. RESULT PAGE: /account/orders/:number (or a /checkout/result) that POLLS
     GET /api/orders/:number until status leaves PENDING (PAID = success). The webhook
     may settle before/after verify; polling is the honest ground truth for the UI.
```

### Reconciliation UX in detail (the launch-blocker part)

- **Pre-pay re-validation is READ-ONLY at review:** step 1 shows the **backend** cart (`GET /cart`), which already reflects server truth (out-of-stock lines were dropped at the `/cart` layer's published/in-stock guard, prices are live at order time). But `GET /cart` does NOT run the full order-create validation (stock quantity vs `stockQty`, soft-delete race). So the review is a *best-effort preview*, not a guarantee.
- **The change surface:** compare the client's last-known cart (Zustand) against the fresh `GET /cart` and render explicit deltas: **"Removed — no longer available"**, **"Only N left — quantity reduced"**, **"Price updated: ₹X → ₹Y"**. Do not silently reprice; the user must SEE the change.
- **The acknowledgment gate:** if any delta exists, the "Place order" button is disabled behind an **"I've reviewed the changes"** acknowledgment (or a re-render that requires a second explicit click). Never auto-charge a total the user didn't see.
- **THE RACE PATH — order-create still 400/409s after review, and the recovery must derive the delta from the ERROR, not from `GET /cart` (CP5-review HIGH — the draft's loop was a dead-end):** between review and `POST /orders`, stock can sell out or a product can be soft-deleted; `createFromCart` re-validates (`orders.service.ts:76-85`) and throws. The draft said "catch it, re-fetch `GET /cart`, re-render deltas" — but **`GET /cart` does NO revalidation** (`cart.service.ts:84-105` echoes stored lines — no stock/soft-delete/coupon check), so re-fetching it after a failure shows **zero delta** and the user re-clicks into the same error forever. The recovery must instead **parse the specific failure and act on it distinctly** (each `createFromCart` throw handled by kind, not a generic "try again"):
  - `"…is out of stock"` / `"Only N … left"` (ConflictException, `:79-83`) → reduce that line to the available `N` (or remove), show "Only N left — quantity reduced," require re-ack.
  - `"…no longer available"` (BadRequest, `:78`, soft-deleted) → remove the line, show "removed — no longer available," re-ack.
  - `"Cart is empty"` (`:64`) → back to the cart page.
  - **Coupon failure** (BadRequest from `coupons.preview`, `:112-114`) → **strip the coupon and offer resubmit WITHOUT it** (see next bullet) — a distinct affordance, never a silent dead-end.
  - `"Stock changed concurrently — please retry"` (CAS, `inventory.service.ts:62-63`) → a transient retry of the SAME submit is correct here (genuine race, not a stale cart).
  - In **every** case: **never proceed to `initiate`/payment on a failed order-create.** Pin: a 4xx at `POST /orders` must NOT open checkout.js.
- **Coupon-expired-at-submit is its own dead-end to break (CP5-review MEDIUM):** the coupon is validated only at order-create (the cart is coupon-unaware, `discount:0`), so a coupon that expired between review and submit 400s with a reason `GET /cart` can't show. Handle it distinctly: surface "Coupon '<code>' is no longer valid — removed," clear `couponCode` from the submit, and let the user place the order without it (or re-enter a different code). Do not loop back to an identical review.
- **Idempotency-Key must key on the DTO, not just the attempt (CP5-review HIGH — the draft would ship to the wrong address):** `createFromCart` does `if (existing) return existing` on the key (`:56-61`) and **never compares the incoming DTO**. The draft's "one stable key per attempt, reused across retries" means: user submits → order created → user goes back, **edits the address**, resubmits under the same key → the server returns the ORIGINAL order with the **OLD address** and ships there. Fix: **the key = a stable hash of `{ attemptId + the normalized submit DTO (address + couponCode) }`.** A literal network retry of the *identical* request → same key → safe replay (no double order). An **edited** resubmit → different key → a new order (the first, abandoned PENDING, is cancelled + restocked by the cron). This trades a rare orphaned-PENDING order for never-ship-to-the-wrong-address — the correct trade.
- **`initiate` returning 409 "already paid" must route to SUCCESS, not an error (CP5-review MEDIUM):** if the user pays, closes checkout.js before the client `verify` runs, the **webhook** settles the order to PAID, then the user re-enters `/checkout` → `POST /razorpay/initiate` throws `ConflictException('Order is already paid')` (`razorpay.service.ts:77-79`, the status gate runs BEFORE reuse-if-fresh). The flow must catch an initiate-409-on-a-non-PENDING-order and **route straight to the result page** (`GET /orders/:number` shows PAID = success) — a paid customer must never see a conflict error. Only a still-PENDING order re-enters checkout.js (backend reuse-if-fresh returns the same rzp order).

- Test: the checkout flow is component/integration-tested with mocked `api.*` — review renders deltas + gates on ack; a 409 at `POST /orders` returns to review and does NOT call `initiate`; a successful path calls initiate→(checkout.js stub)→verify→poll; the Idempotency-Key is stable within an attempt.
- ⛔ **CHECKPOINT CP-4:** demo the full happy path against a real backend + Razorpay test-mode keys (test card → PAID → result page), PLUS the sold-out-mid-checkout path (order-create 409 → back to review, no payment opened).

---

## Phase 5: THE TRAP — untrusted client cart, pinned

**Stated prominently because it is the whole security posture of checkout:** the storefront cart money model is **untrusted client state** (localStorage `wh-cart`, browser-computed `lineTotal`/`subtotal`). The recon confirmed the server is fully authoritative (subtotal from live `Product.priceMinor`, `order.dto.ts` declares no money field, `forbidNonWhitelisted` 400s extras, coupon discount server-computed). This phase makes that a **standing invariant the storefront cannot violate**.

- **Task 5.1:** the checkout `POST /orders` request body is EXACTLY `{ fullName, phone, line1, line2?, city, state, pincode, country?, couponCode? }` — no `price`, `lineTotal`, `subtotal`, `discount`, `total`, `items`, or `quantity`. Line items and quantities live ONLY in the backend cart (keyed by `wh_sid`); the client never sends them to `/orders`.
- **Task 5.2 — the pinning test, asserted at the WIRE (CP5-review LOW — assert the sent body, not the pre-send object):** mock `fetch`/`apiSend` and assert the **actual `JSON.stringify`'d body** POSTed to `/orders` contains ONLY the allowed address + couponCode keys — because an `api.ts` interceptor or a spread-merge could add keys downstream of the form-state mapper. A regression guard fails if any `price`/`total`/`subtotal`/`discount`/`items`/`quantity` key ever reaches the wire. This is the storefront mirror of the backend `forbidNonWhitelisted` (the real belt); the client guard is only meaningful at the wire layer.
- **Task 5.3 — the AUTHORITATIVE amount is the created order's total shown in the Razorpay modal, NOT the cart estimate (CP5-review HIGH — the draft's "what you see is what you're charged" was false):** the `GET /cart` total is a **stale-snapshot, `discount:0`** figure — it uses the frozen cart `unitPriceMinor` (`cart.service.ts:90`) and knows nothing about the coupon, while `POST /orders` reprices from live `Product.priceMinor` (`orders.service.ts:88-91`) and applies the coupon. So the cart total can differ from the charge (and be **higher** than shown — a real trust problem, not benign). The correct model:
  - The cart/review total is an **ESTIMATE**, labeled as such ("Estimated total — confirmed at payment"); never claim it is the charge.
  - The **authoritative charge** is `order.totalMinor`, returned as `amountMinor` from `POST /razorpay/initiate` and **displayed by the Razorpay checkout.js modal itself** — that number IS what's captured, reconciled at settlement (`razorpay-settlement.service.ts` amount guard). The user confirms the real amount in the Razorpay modal before paying.
  - If a discounted/repriced total must be shown BEFORE the modal (product decision O3), that requires a server preview (re-price + apply coupon) — a fast-follow; for MVP the estimate → modal-confirms-real-amount flow is honest and correct.
- Test: 5.2 (wire body) + a test that any pre-modal displayed total is labeled an estimate and the pay-confirmation amount derives from the initiate response, never the client store.

---

## Phase 6: cleanup (folded in)

- **Task 6.1:** `/checkout` now exists — the dead links at `cart/page.tsx:117` and `Footer.tsx:17` resolve. Verify they route to the new page.
- **Task 6.2:** replace the PhonePe trust copy `cart/page.tsx:122` ("Secure checkout via PhonePe · 100% buyer protection") with Razorpay-appropriate copy ("Secure checkout · UPI / cards / netbanking via Razorpay").
- **Task 6.3:** repo-wide storefront grep — no `phonepe`/`PhonePe` strings remain in `Frontend/src` (this is the Phase-9 slice of the migration plan's repo-wide gate).

---

## Test plan

**Pure/unit (Frontend `node:test` via tsx — the repo convention, `Frontend/package.json`; the recon confirmed a Frontend test harness exists):**
- **Mock-fallback hazard (launch-blocker):** `api.products()`/`api.homepage()` mocked to REJECT ⇒ error/empty state, **zero mock/phantom rows** (no `p_*` id, no mock price); regression guard against re-introducing a mock-catalog import into `useCatalog`/`useHomepage`.
- `shop-query` filterAndSort over a live-shaped catalog (unchanged logic, new source).
- cart store: optimistic-apply → **reconcile-to-latest-server**; **concurrent-mutation ordering** (R2-succeeds-then-R1-fails must NOT clobber the newer server state — the CP5 bug); failed-mutation re-fetches server truth (not a stale snapshot); `remove`=`setQuantity(0)`; add-increment reconcile-to-cap; **one-time migration clear** (pre-existing local cart + no `wh_sid` ⇒ cleared + notice).
- checkout **wire-body** guard (Phase 5.2) — assert the `JSON.stringify`'d POST `/orders` body has only address+couponCode; money/line-item-key regression.
- **DTO-keyed Idempotency-Key:** identical resubmit → same key; edited-address resubmit → different key.
- **Error-reason-driven recovery:** each `createFromCart` throw kind maps to its distinct UI action (reduce qty / remove line / strip coupon / transient-retry); a 4xx never opens checkout.js; initiate-409-already-paid routes to the result page.

**Component/integration (mocked `api.*`):**
- ShopGrid/PDP/homepage render from mocked live hooks + empty/not-found states.
- checkout flow state machine: review-with-deltas → ack-gate → order-create → (409 → back to review, no initiate) | (ok → initiate → checkout.js stub → verify → poll).

**Backend (extend the existing harness):**
- CORS preflight allows `Idempotency-Key` (Phase 2).

**Live/manual (gates CP-K, CP-4):**
- Catalog live (DB products + Cloudinary images, FF-2 slug gone, Admin SKU appears).
- Full paid checkout against Razorpay test mode; sold-out-mid-checkout 409 path.

---

## Ordered phases + checkpoints

| # | Phase | Gate |
|---|---|---|
| 1 | **KEYSTONE — catalog live** (ShopGrid, PDP force-dynamic + live `recommended`, useHomepage incl. BestSellerCarousel, wishlist, skin-analysis, `products.ts`/`homepage.ts`/`bestsellers.ts` DELETED, mock-fallback stripped) | ⛔ **CP-K**: live storefront + FF-2-gone + Admin-SKU-appears + backend-down-shows-honest-error (no phantoms) |
| 2 | **CORS** — add `Idempotency-Key` to `allowedHeaders`; record the O2 cookie-topology dependency | preflight test green |
| 3 | **Cart sync-on-mutation** — api.cart.* (widen `apiSend` for PUT), optimistic + reconcile-to-latest-server + per-line sequencing + stepper debounce; one-time migration clear | ⛔ **CP-3**: mutations round-trip; concurrent-clicks + forced-failure reconcile correctly (no clobber) |
| 4 | **/checkout page + reconciliation UX** — full flow + error-reason-driven recovery + DTO-keyed idempotency + initiate-409-already-paid→success | ⛔ **CP-4**: happy path (test-mode PAID) + sold-out-mid-checkout (per-reason recovery, no payment opened) + already-paid-reentry→success |
| 5 | **THE TRAP** — untrusted-cart invariant, wire-level pinning test, estimate-vs-authoritative-amount | wire-body guard green |
| 6 | **Cleanup** — dead links resolve, Razorpay copy, Frontend phonepe-grep clean | grep clean |

**Deferred (fast-follows, recorded, NOT in scope):** guest-cart merge-on-login; cart TTL/GC (**never GC a cart tied to a non-terminal order**); server-side shop filtering (the live `/products` supports `total`+`facets`+category/skin/concern/price params — `products.service.ts:15-36` — unused for MVP); ISR-with-on-demand-revalidation for PDPs (if latency bites); SmartSearch's standalone `concerns.ts` source; a live coupon-preview total before the Razorpay modal (O3).

## Open questions for the human

- **O1 — PDP rendering: RESOLVED — `force-dynamic` (approved).** ISR-with-on-demand-revalidation noted as the fast-follow if PDP latency bites.
- **O2 — cookie topology: FLAGGED as a CUTOVER DEPENDENCY, deliberately unresolved (amendment 4).** Deploy target is Coolify/Traefik on a Hostinger VPS (Mumbai), NOT Railway+Vercel; the final domain scheme is undecided, so same-site vs cross-site is undetermined. Two branches (both in Phase 2 detail): **same-site** ⇒ `wh_sid SameSite=lax` works as-is; **cross-site** ⇒ `wh_sid` must become `SameSite=None; Secure` (a backend change) and be **tested end-to-end on the real topology**. The plan does not design against an assumed topology — that was the Railway mistake in the Razorpay plan. Resolve at cutover.
- **O3 — coupon/total UX: RESOLVED — NO pre-modal preview endpoint.** One pricing engine, one source of truth; do not build a second path that can drift from `createFromCart`. The cart/review figure is an **estimate**, labelled honestly ("Estimated total — confirmed at checkout"). The **authoritative total is the created order's `order.totalMinor`, shown on the review step AFTER `POST /orders` returns and BEFORE checkout.js opens** (the order total already reflects live prices + the coupon). The Razorpay modal then displays that same authoritative amount.
- **O4 — result page: RESOLVED — reuse `/orders/[number]`.** `GET /orders/:number` supports guests via `wh_sid`; poll it for PENDING→PAID. No bespoke thank-you route — a second place that renders order state is a second place that can disagree. It is linkable, refresh-safe, and doubles as the order-status page.
