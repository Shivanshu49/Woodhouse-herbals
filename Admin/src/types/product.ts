/**
 * Admin product types — mirror the backend contract (admin-products module).
 * Kept as plain string unions rather than importing @prisma/client so the
 * admin bundle carries no server dependency.
 */

export type ProductStatus = 'DRAFT' | 'PUBLISHED' | 'SCHEDULED';

export type ProductCategory =
  | 'FACE_WASH'
  | 'SERUM'
  | 'CREAM'
  | 'SCRUB'
  | 'HAIR_OIL'
  | 'SHAMPOO'
  | 'COMBO'
  | 'MASK'
  | 'TONER';

/** Sort tokens accepted by GET /admin/products (AdminProductSort). */
export type AdminProductSort =
  | 'newest'
  | 'oldest'
  | 'price-asc'
  | 'price-desc'
  | 'stock-asc'
  | 'stock-desc'
  | 'name';

/** Server stock-level buckets (?stock=). */
export type StockBucket = 'in' | 'low' | 'out';

/** Bulk action tokens (BulkAction). Note: `archive` is a soft-delete. */
export type BulkAction = 'publish' | 'draft' | 'archive' | 'restore' | 'set-category';

/** One row of GET /admin/products (SUMMARY_SELECT). */
export interface AdminProductRow {
  id: string;
  name: string;
  slug: string;
  sku: string;
  category: ProductCategory;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  stockQty: number;
  inStock: boolean;
  status: ProductStatus;
  featured: boolean;
  thumbnailUrl: string;
  thumbnailAlt: string;
  /** Non-null == archived (soft-deleted). */
  deletedAt: string | null;
  updatedAt: string;
}

/** Shared pagination envelope ({ items, total, page, perPage }). */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}

export type AdminProductsList = Paginated<AdminProductRow>;

/** Query params for GET /admin/products. `priceMin/Max` are in RUPEES. */
export interface AdminProductListParams {
  q?: string;
  status?: ProductStatus;
  category?: ProductCategory;
  stock?: StockBucket;
  priceMin?: number;
  priceMax?: number;
  sort?: AdminProductSort;
  page?: number;
  perPage?: number;
  /** true => only archived (soft-deleted); false/undefined => only live. */
  deleted?: boolean;
}

export interface BulkProductsBody {
  ids: string[];
  action: BulkAction;
  categoryId?: string;
}

export interface BulkProductsResult {
  updated: number;
}

export interface AdjustStockBody {
  productId: string;
  delta: number;
  note?: string;
}

export interface AdjustStockResult {
  previousQty: number;
  newQty: number;
}

/** Free-form category (Category table) used by the set-category bulk action. */
export interface Category {
  id: string;
  slug: string;
  name: string;
}
