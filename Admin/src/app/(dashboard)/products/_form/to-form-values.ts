/**
 * Prefill the product form from a saved product (edit mode) — the inverse of
 * to-create-payload. Must round-trip: load → save-without-changes produces an
 * identical payload (see to-form-values.test.ts) so an edit never silently
 * mutates a product.
 */
import type { ProductDetail } from '@/types/product';
import { paiseToRupees, type GstRateValue } from './pricing';
import type { BadgeToneValue } from './organization';
import type { ProductFormValues, ProductImageInput } from './product-form-schema';

/** UTC ISO → a `datetime-local` value ("YYYY-MM-DDTHH:mm") in the viewer's local
 *  wall-clock, so it inverts `new Date(local).toISOString()`. */
export function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/** Pull our `woodhouse/{products|banners|content}/…` public_id out of a Cloudinary
 *  delivery URL. Any other URL (e.g. a legacy seed image) is returned as-is, so
 *  delete-on-remove (scoped to `woodhouse/`) never tries to destroy it. */
export function extractCloudinaryPublicId(url: string): string {
  const m = url.match(/\/(woodhouse\/(?:products|banners|content)\/[^?]+?)\.[a-zA-Z0-9]+(?:$|\?)/);
  return m ? m[1] : url;
}

export function productToFormValues(d: ProductDetail): ProductFormValues {
  const images: ProductImageInput[] = [];
  if (d.thumbnailUrl) {
    images.push({ url: d.thumbnailUrl, publicId: extractCloudinaryPublicId(d.thumbnailUrl), alt: d.thumbnailAlt });
  }
  for (const g of [...d.gallery].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const img: ProductImageInput = { url: g.url, publicId: extractCloudinaryPublicId(g.url), alt: g.alt };
    if (g.width != null) img.width = g.width;
    if (g.height != null) img.height = g.height;
    images.push(img);
  }

  return {
    name: d.name,
    slug: d.slug,
    sku: d.sku,
    shortDescription: d.shortDescription,
    longDescription: d.longDescription,
    status: d.status,
    publishAt: d.publishAt ? isoToDatetimeLocal(d.publishAt) : '',
    featured: d.featured,
    bestSeller: d.badges.some((b) => b.tone === 'BESTSELLER'),
    images,

    price: paiseToRupees(d.priceMinor),
    compareAtPrice: d.compareAtPriceMinor != null ? paiseToRupees(d.compareAtPriceMinor) : '',
    costPrice: d.costPriceMinor != null ? paiseToRupees(d.costPriceMinor) : '',
    gstRate: (d.gstRate as GstRateValue | null) ?? 'GST_18',
    hsnCode: d.hsnCode ?? '',
    saleStartsAt: d.saleStartsAt ? isoToDatetimeLocal(d.saleStartsAt) : '',
    saleEndsAt: d.saleEndsAt ? isoToDatetimeLocal(d.saleEndsAt) : '',

    trackInventory: d.trackInventory,
    stockQty: String(d.stockQty),
    lowStockThreshold: d.lowStockThreshold != null ? String(d.lowStockThreshold) : '',
    allowBackorder: d.allowBackorder,
    weightGrams: d.weightGrams != null ? String(d.weightGrams) : '',
    lengthCm: d.lengthCm != null ? String(d.lengthCm) : '',
    widthCm: d.widthCm != null ? String(d.widthCm) : '',
    heightCm: d.heightCm != null ? String(d.heightCm) : '',
    shippingClass: d.shippingClass ?? '',
    freeShipping: d.freeShipping,

    category: d.category,
    categoryIds: [...d.categoryLinks]
      .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
      .map((l) => l.categoryId),
    concernIds: d.concerns.map((c) => c.concernId),
    skinTypes: d.skinTypes as ProductFormValues['skinTypes'],
    tags: d.tags,
    // The Best-seller toggle (above) is the sole representation of a BESTSELLER
    // badge — filter it out of the list so it isn't shown twice and the toggle
    // can actually turn it off (the create mapper re-adds it when the toggle is on).
    badges: d.badges.filter((b) => b.tone !== 'BESTSELLER').map((b) => ({ label: b.label, tone: b.tone as BadgeToneValue })),

    ingredients: [...d.ingredients].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => ({ name: i.name, benefit: i.benefit })),
    benefits: [...d.benefitItems].sort((a, b) => a.sortOrder - b.sortOrder).map((b) => b.text),
    howToUse: d.howToUse,
    inciText: d.inciText ?? '',
    usageFrequency: d.usageFrequency ?? '',
    recommendedTime: d.recommendedTime ?? '',
    parabenFree: d.parabenFree,
    sulfateFree: d.sulfateFree,
    crueltyFree: d.crueltyFree,
    vegan: d.vegan,
    alcoholFree: d.alcoholFree,
  };
}
