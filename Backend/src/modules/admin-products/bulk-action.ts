import { BadRequestException } from '@nestjs/common';

export type ResolvedBulkAction =
  | { kind: 'status'; status: 'PUBLISHED' | 'DRAFT' }
  | { kind: 'soft-delete'; deletedAt: Date | null }
  | { kind: 'set-category'; categoryId: string };

/**
 * Translate a `BulkAction` enum value into the write the service should
 * perform. Pure (the caller supplies `now`) so it's testable without a
 * clock or Prisma — see bulk-action.test.ts.
 */
export function resolveBulkAction(
  action: string,
  categoryId: string | undefined,
  now: Date,
): ResolvedBulkAction {
  switch (action) {
    case 'publish':
      return { kind: 'status', status: 'PUBLISHED' };
    case 'draft':
      return { kind: 'status', status: 'DRAFT' };
    case 'archive':
      return { kind: 'soft-delete', deletedAt: now };
    case 'restore':
      return { kind: 'soft-delete', deletedAt: null };
    case 'set-category':
      if (!categoryId) {
        throw new BadRequestException('categoryId is required for the set-category bulk action');
      }
      return { kind: 'set-category', categoryId };
    default:
      throw new BadRequestException(`Unknown bulk action: ${action}`);
  }
}
