import type { ProductSummary } from '@/types';

export interface ShopQuery {
  categories: string[];
  skinTypes: string[];
  concerns: string[];
  price?: string;
  minRating?: number;
  sort?: 'bestsellers' | 'new' | 'price-asc' | 'price-desc' | 'rating';
}

export function parseShopQuery(sp: URLSearchParams): ShopQuery {
  const minR = sp.get('minRating');
  const sortRaw = sp.get('sort') as ShopQuery['sort'] | null;
  return {
    categories: sp.getAll('category'),
    skinTypes: sp.getAll('skinType'),
    concerns: sp.getAll('concern'),
    price: sp.get('price') ?? undefined,
    minRating: minR ? Number(minR) : undefined,
    sort: sortRaw ?? undefined,
  };
}

export function filterAndSort(products: ProductSummary[], q: ShopQuery): ProductSummary[] {
  let out = products.filter((p) => {
    if (q.categories.length && !q.categories.includes(p.category)) return false;
    if (q.skinTypes.length && !p.skinTypes.some((s) => q.skinTypes.includes(s) || q.skinTypes.includes('all'))) return false;
    if (q.concerns.length && !p.concerns.some((c) => q.concerns.includes(c))) return false;
    if (q.minRating !== undefined && p.rating < q.minRating) return false;
    if (q.price) {
      const [lo, hi] = q.price.split('-');
      const priceR = p.price.amount / 100;
      if (lo && priceR < Number(lo)) return false;
      if (hi && priceR > Number(hi)) return false;
    }
    return true;
  });

  switch (q.sort) {
    case 'price-asc':
      out = [...out].sort((a, b) => a.price.amount - b.price.amount);
      break;
    case 'price-desc':
      out = [...out].sort((a, b) => b.price.amount - a.price.amount);
      break;
    case 'rating':
      out = [...out].sort((a, b) => b.rating - a.rating);
      break;
    case 'new':
      out = [...out].sort((a, b) => (b.badges?.some((x) => x.tone === 'new') ? 1 : 0) - (a.badges?.some((x) => x.tone === 'new') ? 1 : 0));
      break;
    case 'bestsellers':
      out = [...out].sort((a, b) => b.reviewCount - a.reviewCount);
      break;
    default:
      break;
  }
  return out;
}
