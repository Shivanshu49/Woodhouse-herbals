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

/**
 * Editorial slug for categories & static pages: collapses ANY run of
 * non-alphanumerics to a single hyphen. Differs from `slugify` above (which
 * strips punctuation without inserting a hyphen, so "a&b" → "ab"); this one
 * gives "a-b". Byte-for-byte mirror of the admin-categories and admin-content
 * backend normalizers, so the client preview matches what the server stores.
 */
export function slugifyContent(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
