# Storefront wiring — deferred to the storefront phase

Admin Phase-E builds the management side of these; the STOREFRONT changes to make
them visible to shoppers are batched here (not built now).

## Section 2 — Categories
- **Filter `isActive` AND `deletedAt` on the public category endpoints.**
  `categories.service.ts` `list()` and `findBySlug()` currently return ALL rows
  (no filter). Until they use `where: { isActive: true, deletedAt: null }`, BOTH
  the admin `isActive` toggle (hide-without-delete) AND soft-delete are inert —
  a hidden or deleted category still renders for shoppers. **(Flagged by the
  Section-2 review as the headline gap; it's a storefront change, so it lands here.)**
- **Storefront "Shop by category" should consume the managed tree + images.** The
  relational Category tree (parent/children, `imageUrl`, sortOrder) is now
  admin-managed; the storefront category nav/tiles should read it (via a public
  tree endpoint) instead of the legacy `ProductCategory` enum / mock data.
- **Respect `sortOrder`** in the public category ordering (already does).

## Section 3 — Inventory
- **None.** Inventory management is admin-internal; the storefront already reads
  `inStock`/`stockStatus`/`stockQty` on products (adjustments flow through those
  existing fields). No storefront change needed.

## Section 4 — Content
Admin now manages HeroBanner / OfferStripItem / Testimonial / Faq / StaticPage
(`/admin/content/*`, ADMIN+MANAGER). The storefront is still 100% mock for all
of this — the batched storefront work:

- **The storefront never calls `GET /homepage` at all.** `api.homepage()` exists,
  is typed (`HomepagePayload`), and is unused — every home section imports the
  mock `src/data/homepage.ts` directly. Wiring all of the below starts with
  actually consuming `/homepage` (and new public endpoints where noted).
- **Banner/offer-strip scheduling is stored but NOT enforced (deferred per the
  Section-4 scope guard).** The admin captures `startsAt`/`endsAt`; `HomepageService`
  ignores them — `hero` = `findFirst({active:true}, orderBy updatedAt desc)` (also
  ignores `sortOrder`, and returns only ONE banner), `offerStrip` = all `active`
  rows. Storefront task: filter both by the `[startsAt, endsAt]` window (now-inside),
  honor `sortOrder`, and decide single-hero vs. a multi-banner carousel (model +
  admin already support many ordered banners; the endpoint + `Hero.tsx` collapse to one).
- **Hero copy is baked into JPG artwork today.** `Hero.tsx` renders a hardcoded
  `BANNERS` image array; the structured `HeroBanner` fields (eyebrow/title/subtitle/
  cta) and the typed `homepage.hero` payload are dead code. Wiring: render the
  structured fields over `imageUrl` (or keep image-only and drop the unused text fields).
- **Offer strip drops `code`/`href`.** `OfferStrip.tsx` renders only `headline`;
  the admin captures a promo `code` + `href` too. Wiring: surface them.
- **Testimonials / FAQs / StaticPages have NO public read endpoint yet** — only the
  admin CRUD exists. `Testimonials.tsx` uses a mock inline array; `/faqs` and
  `/policies/*` routes 404 (linked from the Footer but never built); `/about` is a
  hardcoded component. Storefront work = add public read endpoints (list active
  testimonials; list active FAQs; get published page by slug) AND build the
  `/faqs` + `/policies/[slug]` (+ migrate `/about`) routes to consume them.
- **Homepage product sections stay flag-derived (Section-4 guard resolution).** The
  admin "Homepage sections" tab is a READ overview mirroring `HomepageService`'s
  rules — bestsellers = a `BESTSELLER` badge, new arrivals = a `NEW` badge, combo
  packs = `isCombo` — deep-linking to the product editor where those flags live. No
  new selection model was built; `HomepageSelection` and `product.featured` remain
  orphaned (nothing reads them). As of the July 2026 homepage feedback round the
  storefront carousel (`src/data/bestsellers.ts`) mirrors the backend rule
  client-side: only products whose badges include `tone: 'bestseller'`, ordered by
  `reviewCount`, **capped at 8**. Wiring = replace that derivation with the
  `/homepage` bestsellers (BESTSELLER-badge) query, keeping the 8-item cap. Also
  note the `/homepage` product queries have **no `orderBy`**, so any admin-intended
  ordering isn't honored yet (add `orderBy` if curated order matters).
