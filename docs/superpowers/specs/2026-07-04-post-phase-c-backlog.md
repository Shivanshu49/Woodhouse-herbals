# Post-Phase-C backlog

Recorded 2026-07-04. Six features captured for later, **not to be built now**.
Each gets its own spec (brainstorm → design → plan) when its phase is scheduled;
this doc only assigns rough phases, dependencies, and sequencing.

Anchors from `2026-07-03-admin-panel-design.md` §4:
- Admin phases: **A** Foundations ✓, **B** Shell ✓, **C** Dashboard ✓,
  **D** Products (in progress — the Add-Product form), **E** Orders,
  **F** Categories + Settings.
- Admin "later phases" (own spec each): Customers, Coupons UI, Inventory,
  Reviews, **Content**, **Analytics**, **Marketing**, **Shipping**.

These backlog items introduce a **Storefront track (SF-*)** — a new set of
storefront-side phases not in the original admin roadmap. They can run in
parallel with the admin later-phases once Phase D/E land.

## Summary & phase assignments

| # | Feature | Lands in | Depends on | New migration? |
|---|---------|----------|------------|----------------|
| BACKLOG-1 | Commerce Analytics Expansion | **Analytics phase** (admin) + storefront event firing | BACKLOG-6 (consent, for user tracking) | **Yes** — `AnalyticsEvent` table |
| BACKLOG-2 | Meta Pixel + Conversions API | **SF-2 Marketing & Tracking** (storefront) + NestJS CAPI | BACKLOG-6 | No (event log optional) |
| BACKLOG-3 | Storefront product-section redesign | **SF-3 Storefront Redesign** | — (reference screenshots pending) | No |
| BACKLOG-4 | "Watch & Love It" video reels | **Content phase** (admin video manager) + **SF-5 Homepage** (storefront) | Uploads module (exists); R2/Cloudinary-video | **Yes** — `HomepageVideo` (or reuse `HomepageSelection`) |
| BACKLOG-5 | PDP image hover-zoom | **SF-4 PDP Enhancements** (storefront) | Cloudinary zoom variant (exists) | No |
| BACKLOG-6 | Cookie consent banner | **SF-1 Consent & Compliance** (storefront) | — (**gates** BACKLOG-1 tracking + BACKLOG-2) | No |

### Sequencing (storefront track)
`SF-1 Consent` **first** → unblocks user-level analytics + pixel. Then
`SF-2 Tracking` and the storefront half of `BACKLOG-1`. `SF-3 Redesign`,
`SF-4 PDP zoom`, `SF-5 Video` are independent and can slot by priority.
BACKLOG-1's admin dashboards and BACKLOG-4's admin manager can start on the
admin track independently of the storefront track.

---

## BACKLOG-1 — Commerce Analytics Expansion
**Phase:** Admin **Analytics phase** (extends its spec) + a storefront event-firing slice. Backend model + endpoint can ship first.
- **Backend:** new `AnalyticsEvent` model (`sessionId`, `userId` nullable, `productId` nullable, `eventType` enum: `cart_add|cart_remove|checkout_start|purchase`, `metadata` jsonb, `createdAt`). Needs a **new migration** (not covered by the Phase-A set). `POST /events` — **public**, rate-limited, accepts anonymous (sessionId cookie) events; auth optional. Consider async write / batching.
- **Admin Analytics additions:** abandoned-cart list (cart_add + no purchase within X h, with product + user/email if known), most-abandoned products, most-added products, repeat-buyer segment (2+ orders), most-reordered products, new-vs-returning ratio.
- **Later hook:** abandoned-cart recovery (email/WhatsApp) — defer, pairs with Marketing phase.
- **Depends on:** BACKLOG-6 for *user-identified* tracking (anonymous session events can precede consent only if DPDP-permissible; gate PII/user linkage behind consent).

## BACKLOG-2 — Meta Pixel + Conversions API (storefront)
**Phase:** **SF-2 Marketing & Tracking**. **Depends on BACKLOG-6.**
- Base Meta Pixel on all storefront pages (pixel ID from env, e.g. `NEXT_PUBLIC_META_PIXEL_ID`).
- Browser events: `PageView`, `ViewContent` (PDP, `content_ids` + `value`), `AddToCart`, `InitiateCheckout`, `Purchase` (order value + `currency: INR`).
- **Server-side Conversions API** from NestJS for AddToCart/InitiateCheckout/Purchase, with **`event_id` dedup** between browser + server (generate a shared event_id per event).
- **Consent-gated:** pixel fires only after cookie-consent accept (BACKLOG-6).

## BACKLOG-3 — Storefront product-section redesign
**Phase:** **SF-3 Storefront Redesign** (design-led). Reference screenshots (MyWishCare-style) to be provided at kickoff.
- Benefit-led product cards, shop-by-concern tiles (uses the concern taxonomy from admin GROUP-5 Organization), ingredient highlights, rating badges.
- Brainstorm/frontend-design pass required; not mechanical.

## BACKLOG-4 — "Watch & Love It" video section (homepage)
**Phase:** admin manager in the **Content phase**; storefront section as **SF-5 Homepage**.
- Self-hosted short video reels (Cloudinary video or R2 — decide at spec time; uploads module + `R2_*`/Cloudinary already scaffolded). Each reel links to a product.
- **Admin:** extend the Content manager — add/reorder/delete videos, link product. Likely a **new `HomepageVideo` model** (or extend `HomepageSelection`) → migration.
- **Storefront:** swipeable cards on the homepage with a product-CTA overlay.
- No Instagram API dependency.

## BACKLOG-5 — PDP image hover-zoom
**Phase:** **SF-4 PDP Enhancements** (small, storefront-only).
- Desktop: hover lens/magnifier on the PDP gallery, using the **Cloudinary zoom variant we already generate**.
- Mobile: pinch-zoom + double-tap in the gallery lightbox.

## BACKLOG-6 — Cookie consent banner
**Phase:** **SF-1 Consent & Compliance** — **first in the storefront track; a hard dependency for BACKLOG-1 (user tracking) and BACKLOG-2.**
- Accept/reject banner; persists the choice (cookie/localStorage).
- **Gates Meta Pixel + GA** (and any user-level analytics) until accepted.
- **DPDP Act** compliance rationale (we track users). Consider granular categories (necessary vs analytics vs marketing) at spec time.
