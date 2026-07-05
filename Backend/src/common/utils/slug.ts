/**
 * Editorial slug for admin-managed content addressed by URL: categories and
 * static pages. Collapses ANY run of non-alphanumerics to a single hyphen,
 * lowercases, and trims edge hyphens. Distinct from the PRODUCT slug
 * (admin-products/product-slug.ts), which strips punctuation without inserting
 * a hyphen — do not conflate the two.
 */
export function contentSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
