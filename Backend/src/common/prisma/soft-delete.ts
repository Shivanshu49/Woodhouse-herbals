import type { Prisma } from '@prisma/client';

/**
 * Soft-delete convention for this codebase.
 *
 * Models with a `deletedAt` column (Product, User, Review, Category) MUST be
 * read through these helpers, or queries must explicitly include the
 * filter. The convention is "default-exclude" — the only allow-listed
 * places that see deleted rows are admin endpoints behind RolesGuard.
 *
 * We deliberately keep this as a set of small typed helpers rather than a
 * Prisma client extension: extensions change the inferred client type,
 * which fights NestJS's DI typing and adds compile-time friction every
 * time a new service needs the client. Helpers are explicit at the call
 * site, which makes audit reviews trivial ("grep for findMany on Product
 * without excludeDeleted").
 *
 * Usage:
 *
 *   await this.prisma.product.findMany({
 *     where: excludeDeleted({ category: 'SERUM' }),
 *   });
 *
 * To soft-delete a row:
 *
 *   await this.prisma.product.update({
 *     where: { id },
 *     data: softDelete(),
 *   });
 *
 * To list deleted rows from an admin endpoint, just pass an explicit
 * `deletedAt` filter; the helper does not add one when one is already
 * present.
 */

export function excludeDeleted<T extends Record<string, unknown> | undefined>(where?: T): T {
  if (where && 'deletedAt' in where) return where;
  // We deliberately widen through `unknown` — callers' generic `T` is a Prisma
  // where-input that already permits `deletedAt`, but TypeScript can't prove
  // that from the conditional bound.
  return { ...(where ?? {}), deletedAt: null } as unknown as T;
}

export function softDelete(): { deletedAt: Date } {
  return { deletedAt: new Date() };
}

/**
 * Composes with explicit `where` clauses on Prisma where-input types where
 * AND is the natural combiner (e.g. when callers want to layer extra
 * predicates without losing the deletedAt filter).
 */
export function withNotDeleted<T extends { AND?: unknown }>(where: T): T {
  return { ...where, deletedAt: null } as T;
}

export type SoftDeletable = { deletedAt?: Date | null };

/**
 * Type guard so admin response shapes can distinguish live vs deleted rows
 * without scattering null checks across the controller layer.
 */
export function isDeleted<T extends SoftDeletable>(row: T): boolean {
  return row.deletedAt !== null && row.deletedAt !== undefined;
}

/**
 * Pre-typed Prisma fragments — saves importing Prisma in every call site.
 */
export const NOT_DELETED: Prisma.DateTimeNullableFilter = { equals: null };
