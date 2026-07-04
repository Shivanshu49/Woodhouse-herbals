/**
 * Turn a free-form product name into a URL-safe slug. Byte-for-byte mirror of
 * the backend `slugify` (Backend/src/modules/admin-products/product-slug.ts) so
 * the client preview matches what the server derives/validates
 * (SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/).
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
