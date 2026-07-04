/**
 * Turn a stored image URL into a small square "card" thumbnail.
 *
 * Product images are persisted as full delivery URLs (Cloudinary secure_urls
 * in production; Unsplash placeholders in seed data). When the URL is a
 * Cloudinary delivery URL we splice a transform — crop-to-fill with auto
 * gravity, quality and format — into the `/upload/` segment so the table pulls
 * a light, correctly-cropped thumbnail rather than the full-res original.
 * Any other host is returned unchanged (still fine to render at a small size).
 *
 * @param px  target square size in device pixels (default 96 = a 48px @2x thumb)
 */
export function cloudinaryThumb(url: string | null | undefined, px = 96): string | null {
  if (!url) return null;
  const marker = '/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1 || !url.includes('res.cloudinary.com')) return url;

  const after = url.slice(idx + marker.length);
  const firstSegment = after.split('/')[0] ?? '';
  // A transform segment carries comma-separated `key_value` tokens (e.g.
  // "c_fill,w_96"); a bare version segment looks like "v1234567". Skip if the
  // URL already has a transform so we never stack two.
  const alreadyTransformed = firstSegment.includes(',') || /^[a-z]{1,3}_/.test(firstSegment);
  if (alreadyTransformed) return url;

  const transform = `c_fill,g_auto,w_${px},h_${px},q_auto,f_auto`;
  return `${url.slice(0, idx + marker.length)}${transform}/${after}`;
}
