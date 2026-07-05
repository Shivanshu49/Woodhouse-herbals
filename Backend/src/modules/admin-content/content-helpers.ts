/**
 * Pure helpers for the admin content module — kept separate from the service
 * so they can be unit-tested with no Prisma dependency (this codebase's
 * convention: the service/controller stay thin, the logic is tested here).
 */

/** Next append position for a sortable list: one past the current max (1-based). */
export function nextSortOrder(currentMax: number | null | undefined): number {
  return (currentMax ?? 0) + 1;
}

/**
 * Validate an optional [startsAt, endsAt] schedule window. Returns an error
 * message when the window is inverted or empty (end <= start), else null.
 * An open-ended window (either bound absent) is always valid.
 */
export function dateWindowError(
  startsAt: Date | null,
  endsAt: Date | null,
): string | null {
  if (!startsAt || !endsAt) return null;
  if (endsAt.getTime() <= startsAt.getTime()) {
    return 'The end date must be after the start date.';
  }
  return null;
}

/** URL-safe slug for a static page — the shared editorial slug (same rule as
 *  categories); see common/utils/slug.ts. */
export { contentSlug as normalizePageSlug } from '../../common/utils/slug';
