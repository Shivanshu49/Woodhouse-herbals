import { products } from './products';

export interface BestsellerProduct {
  slug: string;
  name: string;
  type: string;
  size: string;
  ingredientLine: string;
  price: number;
  compareAtPrice?: number;
  rating: number;
  image: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  'face-wash': 'Face Wash',
  serum: 'Face Serum',
  scrub: 'Face Scrub',
  cream: 'Face Cream',
  'hair-oil': 'Hair Oil',
  shampoo: 'Shampoo',
  combo: 'Combo Kit',
};

function prettyCategory(category: string): string {
  return (
    CATEGORY_LABELS[category] ??
    category
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}

/** Short "With X & Y" line from the first couple of hero ingredients. */
function ingredientLine(names: string[]): string {
  const top = names.slice(0, 2).map((n) => n.replace(/\s*\d+%?\s*$/, '').trim());
  if (top.length >= 2) return `With ${top[0]} & ${top[1]}`;
  if (top.length === 1) return `With ${top[0]}`;
  return 'Herbal actives';
}

/**
 * Best-seller carousel data, DERIVED from the canonical product catalog.
 *
 * Previously this was a hand-authored list with its own slugs and rupee
 * prices, which drifted from `products.ts` — every carousel link 404'd because
 * its slugs (e.g. `vitamin-c-face-wash`) didn't exist on any product page.
 * Deriving from `products` keeps a single source of truth: slugs always
 * resolve to a real PDP and prices stay in sync. Ordered by review count as a
 * reasonable "best seller" proxy.
 */
export const bestsellerProducts: BestsellerProduct[] = [...products]
  .sort((a, b) => b.reviewCount - a.reviewCount)
  .map((p) => ({
    slug: p.slug,
    name: p.name,
    type: prettyCategory(p.category),
    size: p.size ?? '',
    ingredientLine: ingredientLine(p.ingredients.map((i) => i.name)),
    price: Math.round(p.price.amount / 100),
    compareAtPrice: p.compareAtPrice ? Math.round(p.compareAtPrice.amount / 100) : undefined,
    rating: p.rating,
    image: p.thumbnail.url,
  }));
