# Storefront wiring — deferred fast-follows

Tracked items deferred from the Tier 1 image work (real Cloudinary packshots
for the first two existing catalog records, July 2026 asset drop). Neither
blocks Tier 2 from starting.

---

## Important

### FF-1 — Move Cloudinary transforms out of stored URLs into a render helper
Tier 1 baked `f_auto,q_auto,c_limit,w_1600` directly into the `thumbnailUrl`
and gallery URLs of the two seeded records. That guarantees optimized delivery
everywhere today, but it hard-codes a delivery policy into data: width caps
can't vary per surface (a 96px admin thumb pays for a w_1600 source), and any
future transform change means a data migration instead of a code change. The
Admin already has the right pattern (`cloudinaryThumb()` splices transforms at
render time and guards against double-stacking).
- **Where:** `Backend/prisma/seed.ts` (the two records),
  `Admin/src/lib/cloudinary.ts` (existing helper to generalise),
  storefront render sites once products go live.
- **Fix:** in the Tier 2 Admin image pipeline, store bare
  `res.cloudinary.com/.../upload/v<ver>/<public_id>` URLs and apply
  `f_auto,q_auto` + per-surface width transforms in a shared render helper;
  backfill the two Tier 1 records (`vitamin-c-niacinamide-serum`,
  `niacinamide-face-wash`) to bare URLs at the same time.

### FF-2 — Reconcile `p_acne_facewash` against `niacinamide-face-wash`
The Frontend mock's `anti-acne-salicylic-face-wash` (id `p_acne_facewash`) is
likely a phantom duplicate of the real Neem Face Wash: the physical product is
"Neem Face Wash — With Niacinamide" (niacinamide is the only on-pack active;
there is no salicylic SKU in the asset drop), and the mock record wears Neem's
imagery (`neem-face-wash.png` in its gallery).
- **Where:** `Frontend/src/data/products.ts:56-92` (the only file that names
  it); it flows into the bestseller carousel and homepage via badge filters
  (`Frontend/src/data/bestsellers.ts:35-49`,
  `Frontend/src/data/homepage.ts:22`); reachable through generic
  `/shop/${slug}` links in six components (BestsellerCard, ProductCard ×2,
  SmartSearch, skin-analysis page, cart page).
- **Fix:** merge or repoint the mock record at the real
  `niacinamide-face-wash` identity (slug, name, copy, Cloudinary images); the
  badge-driven bestseller/homepage inclusion and the six `/shop/${slug}` link
  sites follow the record automatically — verify each after the merge. Leave
  `Frontend/src/data/concerns.ts:8` untouched: the Acne concern tile's
  `neem-face-wash.png` reference is independent of the product record.
