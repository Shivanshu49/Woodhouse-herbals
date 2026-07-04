import type { Prisma } from '@prisma/client';

export enum AdminOrderSort {
  Newest = 'newest',
  Oldest = 'oldest',
  TotalHigh = 'total_high',
  TotalLow = 'total_low',
}

export function buildAdminOrderOrderBy(sort?: AdminOrderSort): Prisma.OrderOrderByWithRelationInput {
  switch (sort) {
    case AdminOrderSort.Oldest:
      return { placedAt: 'asc' };
    case AdminOrderSort.TotalHigh:
      return { totalMinor: 'desc' };
    case AdminOrderSort.TotalLow:
      return { totalMinor: 'asc' };
    case AdminOrderSort.Newest:
    default:
      return { placedAt: 'desc' };
  }
}
