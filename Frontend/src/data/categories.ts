/**
 * Canonical store category list — ONE ordered source for every surface that
 * names a category, so the circle bar and product cards can't drift apart.
 *
 * `label` is the navigation copy (client's wording for the category bar);
 * `cardLabel` is the singular product-type line on cards ("Face Serum,
 * 100 ML") where the nav plural/shorthand would read wrong.
 */
export interface StoreCategory {
  slug: string;
  label: string;
  cardLabel: string;
  /** Announced in the nav but not shippable yet — rendered with a badge. */
  comingSoon?: boolean;
}

// Shampoo intentionally has no entry: the client dropped it from the nav
// (its lone catalog item is placeholder-only); cards fall back to the
// title-cased slug if a shampoo product resurfaces.
export const STORE_CATEGORIES: StoreCategory[] = [
  { slug: 'face-wash', label: 'Face Wash', cardLabel: 'Face Wash' },
  { slug: 'serum', label: 'Serum', cardLabel: 'Face Serum' },
  { slug: 'scrub', label: 'Scrub', cardLabel: 'Face Scrub' },
  { slug: 'cream', label: 'Face Cream', cardLabel: 'Face Cream' },
  { slug: 'combo', label: 'Combo Kits', cardLabel: 'Combo Kit' },
  { slug: 'hair-oil', label: 'Hair care', cardLabel: 'Hair Oil', comingSoon: true },
];

const BY_SLUG = new Map(STORE_CATEGORIES.map((c) => [c.slug, c]));

/** Product-type line for cards; falls back to title-casing unknown slugs. */
export function categoryCardLabel(slug: string): string {
  return (
    BY_SLUG.get(slug)?.cardLabel ??
    slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}
