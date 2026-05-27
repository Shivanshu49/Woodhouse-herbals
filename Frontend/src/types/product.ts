export type SkinType = 'oily' | 'dry' | 'combination' | 'sensitive' | 'normal' | 'all';

export type HairConcern =
  | 'hair-fall'
  | 'dandruff'
  | 'frizz'
  | 'dry-scalp'
  | 'thinning'
  | 'damage';

export type SkinConcern =
  | 'acne'
  | 'pigmentation'
  | 'dry-skin'
  | 'dullness'
  | 'aging'
  | 'tan'
  | 'oily-skin'
  | 'sensitive-skin';

export type ProductCategory =
  | 'face-wash'
  | 'serum'
  | 'cream'
  | 'scrub'
  | 'hair-oil'
  | 'shampoo'
  | 'combo'
  | 'mask'
  | 'toner';

export interface Money {
  amount: number; // minor units: paise
  currency: 'INR';
}

export interface ProductImage {
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface Ingredient {
  name: string;
  benefit: string;
  iconUrl?: string;
}

export interface ProductBadge {
  label: string;
  tone: 'bestseller' | 'new' | 'sale' | 'limited';
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  price: Money;
  compareAtPrice?: Money | null;
  thumbnail: ProductImage;
  rating: number;
  reviewCount: number;
  badges?: ProductBadge[];
  category: ProductCategory;
  concerns: (SkinConcern | HairConcern)[];
  skinTypes: SkinType[];
  inStock: boolean;
}

export interface Product extends ProductSummary {
  gallery: ProductImage[];
  longDescription: string;
  ingredients: Ingredient[];
  benefits: string[];
  howToUse: string[];
  size?: string;
  sku: string;
  isCombo: boolean;
}
