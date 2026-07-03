import type { Prisma, ProductCategory, ProductStatus } from '@prisma/client';

/**
 * Filter inputs accepted by the admin product list endpoint. Kept as a
 * plain structural type (not the DTO class) so this stays a pure,
 * Prisma-mockless-testable function — see admin-product-where.test.ts.
 */
export interface AdminProductWhereFilters {
  q?: string;
  status?: string;
  category?: string;
  stock?: 'in' | 'out' | 'low';
  priceMin?: number;
  priceMax?: number;
  deleted?: boolean;
}

// 'low' stock uses this fixed bucket rather than each product's own
// `lowStockThreshold` column — comparing stockQty against a per-row column
// needs a raw SQL predicate (Prisma can't compare two columns in a plain
// `where`). Revisit with $queryRaw if per-product thresholds are needed here.
const LOW_STOCK_BUCKET = 5;

export function buildAdminProductWhere(dto: AdminProductWhereFilters): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};

  where.deletedAt = dto.deleted === true ? { not: null } : null;

  if (dto.q) {
    where.OR = [
      { name: { contains: dto.q, mode: 'insensitive' } },
      { sku: { contains: dto.q, mode: 'insensitive' } },
    ];
  }

  if (dto.status) {
    where.status = dto.status as ProductStatus;
  }

  if (dto.category) {
    where.category = dto.category as ProductCategory;
  }

  if (dto.stock === 'out') {
    where.stockQty = { lte: 0 };
  } else if (dto.stock === 'in') {
    where.stockQty = { gt: 0 };
  } else if (dto.stock === 'low') {
    where.stockQty = { gt: 0, lte: LOW_STOCK_BUCKET };
  }

  if (dto.priceMin !== undefined || dto.priceMax !== undefined) {
    where.priceMinor = {};
    if (dto.priceMin !== undefined) {
      (where.priceMinor as Prisma.IntFilter).gte = dto.priceMin * 100;
    }
    if (dto.priceMax !== undefined) {
      (where.priceMinor as Prisma.IntFilter).lte = dto.priceMax * 100;
    }
  }

  return where;
}
