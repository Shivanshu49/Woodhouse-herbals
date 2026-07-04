import type { ProductImageInput } from './product-form-schema';

/**
 * The index at which to insert a just-finished upload so the committed images
 * stay in the order the files were *selected*, not the order they happened to
 * finish uploading. Without this, a small file selected second can win index 0
 * (the main image) over a larger file selected first.
 *
 * It inserts the new image before the first already-committed image that was
 * selected LATER (a higher seq). Images with no recorded seq — e.g. pre-existing
 * images loaded in edit mode — never pull a new upload ahead of them, so fresh
 * uploads land after them.
 */
export function orderedInsertIndex(
  images: { publicId: string }[],
  seq: number,
  seqByPublicId: Map<string, number>,
): number {
  for (let i = 0; i < images.length; i++) {
    const s = seqByPublicId.get(images[i].publicId);
    if (s !== undefined && s > seq) return i;
  }
  return images.length;
}

/**
 * The image-related fields of the create/update product payload. The ordered
 * `images` array is the single source of truth for order: the first image is
 * the main image (thumbnail), the rest become the gallery with `sortOrder`
 * following their array position ("order-index").
 */
export interface ProductImagesPayload {
  thumbnailUrl: string;
  thumbnailAlt: string;
  gallery: { url: string; alt: string; sortOrder: number; width?: number; height?: number }[];
}

/**
 * Map the ordered form images to the backend's thumbnail + gallery shape.
 * Returns `null` when there are no images (a draft with no main image), so the
 * caller can omit the image fields from the payload.
 */
export function productImagesToPayload(images: ProductImageInput[]): ProductImagesPayload | null {
  if (images.length === 0) return null;
  const [main, ...rest] = images;
  return {
    thumbnailUrl: main.url,
    thumbnailAlt: main.alt,
    gallery: rest.map((img, index) => ({
      url: img.url,
      alt: img.alt,
      sortOrder: index,
      ...(img.width !== undefined ? { width: img.width } : {}),
      ...(img.height !== undefined ? { height: img.height } : {}),
    })),
  };
}
