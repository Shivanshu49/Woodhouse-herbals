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
