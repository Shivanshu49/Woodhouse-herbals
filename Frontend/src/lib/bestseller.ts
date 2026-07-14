import type { ProductSummary } from '@/types';
import { categoryCardLabel } from '@/data/categories';

/** The shape the "Best Seller" carousel card renders. */
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
  /** Full summary — add-to-cart keys off it, so it carries the real DB id. */
  summary: ProductSummary;
}

/**
 * Adapt a live `ProductSummary` (from the `GET /api/homepage` `bestsellers`
 * array) into the carousel's `BestsellerProduct` shape.
 *
 * `ProductSummary` has no `size` or ingredient list (those live on the full
 * `Product`), so `size` is left empty (the card hides the trailing separator)
 * and the italic line falls back to the product's `shortDescription`. Price is
 * the whole-rupee figure the card renders next to a standalone ₹ glyph.
 */
export function toBestseller(p: ProductSummary): BestsellerProduct {
  return {
    slug: p.slug,
    name: p.name,
    type: categoryCardLabel(p.category),
    size: '',
    ingredientLine: p.shortDescription,
    price: Math.round(p.price.amount / 100),
    compareAtPrice: p.compareAtPrice ? Math.round(p.compareAtPrice.amount / 100) : undefined,
    rating: p.rating,
    image: p.thumbnail.url,
    summary: p,
  };
}
