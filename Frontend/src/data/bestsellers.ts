import type { ProductSummary } from '@/types';
import { products, productSummaries } from './products';

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
  /** Full summary — needed by add-to-cart (cart lines key off summary fields). */
  summary: ProductSummary;
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
 * Only products carrying the BESTSELLER badge flag qualify (client feedback:
 * the carousel must not show the whole catalog), ordered by review count and
 * capped at 8. When the storefront wires to the admin API this becomes the
 * `/homepage` bestsellers (badge-flag) query — see storefront-wiring.md.
 */
export const bestsellerProducts: BestsellerProduct[] = [...products]
  .filter((p) => p.badges?.some((b) => b.tone === 'bestseller'))
  .sort((a, b) => b.reviewCount - a.reviewCount)
  .slice(0, 8)
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
    summary: productSummaries.find((s) => s.id === p.id)!,
  }));
