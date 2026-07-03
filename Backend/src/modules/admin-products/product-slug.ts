/**
 * Turn a free-form product name into a URL-safe slug.
 *
 * lowercase → trim → spaces/underscores collapse to a single dash → strip
 * anything outside [a-z0-9-] → collapse repeated dashes → trim leading/
 * trailing dashes. Pure and deterministic so the admin UI can preview the
 * slug client-side and the backend can re-derive/validate it identically.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
