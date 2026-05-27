import type { ProductSummary, Product, SkinConcern, HairConcern, SkinType, ProductCategory } from './product';
import type { ConcernCard } from './concern';

export interface HomepagePayload {
  offerStrip: {
    headline: string;
    code?: string;
    href: string;
  }[];
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    ctaLabel: string;
    ctaHref: string;
    image: string;
    accent?: string;
  };
  bestsellers: ProductSummary[];
  newArrivals: ProductSummary[];
  comboPacks: ProductSummary[];
  concerns: ConcernCard[];
  trust: { icon: string; title: string; subtitle: string }[];
}

export interface ProductListResponse {
  items: ProductSummary[];
  total: number;
  facets: {
    categories: { value: ProductCategory; count: number; label: string }[];
    skinTypes: { value: SkinType; count: number; label: string }[];
    skinConcerns: { value: SkinConcern; count: number; label: string }[];
    hairConcerns: { value: HairConcern; count: number; label: string }[];
    priceRange: { min: number; max: number };
  };
}

export interface ProductDetailResponse {
  product: Product;
  recommended: ProductSummary[];
}

export interface SearchSuggestion {
  type: 'product' | 'concern' | 'category' | 'query';
  label: string;
  href: string;
  image?: string;
  priceLabel?: string;
}

export interface SearchSuggestResponse {
  suggestions: SearchSuggestion[];
  trending: string[];
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}
