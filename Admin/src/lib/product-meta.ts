import type {
  AdminProductSort,
  ProductCategory,
  ProductStatus,
  StockBucket,
} from '@/types/product';

/**
 * Must match the backend's fixed LOW_STOCK_BUCKET (admin-product-where.ts) so
 * the row's stock badge agrees with what the `?stock=low` filter returns.
 */
export const LOW_STOCK_THRESHOLD = 5;

export function stockBucketFor(qty: number): StockBucket {
  if (qty <= 0) return 'out';
  if (qty <= LOW_STOCK_THRESHOLD) return 'low';
  return 'in';
}

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  FACE_WASH: 'Face Wash',
  SERUM: 'Serum',
  CREAM: 'Cream',
  SCRUB: 'Scrub',
  HAIR_OIL: 'Hair Oil',
  SHAMPOO: 'Shampoo',
  COMBO: 'Combo',
  MASK: 'Mask',
  TONER: 'Toner',
};

export const CATEGORY_OPTIONS = (Object.keys(CATEGORY_LABELS) as ProductCategory[]).map(
  (value) => ({ value, label: CATEGORY_LABELS[value] }),
);

export const SORT_OPTIONS: { value: AdminProductSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'stock-desc', label: 'Stock: high to low' },
  { value: 'stock-asc', label: 'Stock: low to high' },
  { value: 'name', label: 'Name: A–Z' },
];

export const STOCK_OPTIONS: { value: StockBucket; label: string }[] = [
  { value: 'in', label: 'In stock' },
  { value: 'low', label: 'Low stock' },
  { value: 'out', label: 'Out of stock' },
];

/** UI status filter: 'ALL' clears the filter; 'ARCHIVED' maps to deleted=true. */
export type StatusFilter = 'ALL' | ProductStatus | 'ARCHIVED';

export const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export const STATUS_LABELS: Record<ProductStatus, string> = {
  PUBLISHED: 'Published',
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
};
