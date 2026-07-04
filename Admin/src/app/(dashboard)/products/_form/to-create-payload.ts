/**
 * Assemble the full `POST /admin/products` body from the product form — the
 * GROUP 7 wiring. Ties every section's *ToPayload helper together with the core
 * fields. Pure and fully unit-tested; the mutation hook just sends the result.
 */
import type { ProductFormValues } from './product-form-schema';
import { productImagesToPayload } from './product-images';
import { pricingToPayload } from './pricing';
import { inventoryToPayload } from './inventory';
import { organizationToPayload } from './organization';
import { ingredientsUsageToPayload } from './ingredients';

export function productFormToCreatePayload(v: ProductFormValues): Record<string, unknown> {
  const images = productImagesToPayload(v.images);
  const pricing = pricingToPayload({
    price: v.price,
    compareAtPrice: v.compareAtPrice,
    costPrice: v.costPrice,
    gstRate: v.gstRate,
    hsnCode: v.hsnCode,
    saleStartsAt: v.saleStartsAt,
    saleEndsAt: v.saleEndsAt,
  });
  const inventory = inventoryToPayload({
    trackInventory: v.trackInventory,
    stockQty: v.stockQty,
    lowStockThreshold: v.lowStockThreshold,
    allowBackorder: v.allowBackorder,
    weightGrams: v.weightGrams,
    lengthCm: v.lengthCm,
    widthCm: v.widthCm,
    heightCm: v.heightCm,
    shippingClass: v.shippingClass,
    freeShipping: v.freeShipping,
  });
  const organization = organizationToPayload({
    category: v.category,
    categoryIds: v.categoryIds,
    concernIds: v.concernIds,
    skinTypes: v.skinTypes,
    tags: v.tags,
    badges: v.badges,
  });
  const usage = ingredientsUsageToPayload({
    ingredients: v.ingredients,
    benefits: v.benefits,
    howToUse: v.howToUse,
    inciText: v.inciText,
    usageFrequency: v.usageFrequency,
    recommendedTime: v.recommendedTime,
    parabenFree: v.parabenFree,
    sulfateFree: v.sulfateFree,
    crueltyFree: v.crueltyFree,
    vegan: v.vegan,
    alcoholFree: v.alcoholFree,
  });

  // The "Best-seller" toggle adds a Bestseller badge on the storefront (it has
  // no dedicated backend field) — append one unless a BESTSELLER badge exists.
  let badges: { label: string; tone: string }[] = organization.badges ?? [];
  if (v.bestSeller && !badges.some((b) => b.tone === 'BESTSELLER')) {
    badges = [...badges, { label: 'Bestseller', tone: 'BESTSELLER' }];
  }

  const payload: Record<string, unknown> = {
    name: v.name.trim(),
    slug: v.slug.trim(),
    sku: v.sku.trim(),
    shortDescription: v.shortDescription.trim(),
    longDescription: v.longDescription,
    status: v.status,
    featured: v.featured,
    // Media — an image-less draft still needs a (blank) thumbnail (NOT NULL column).
    thumbnailUrl: images?.thumbnailUrl ?? '',
    thumbnailAlt: images?.thumbnailAlt ?? '',
    ...pricing,
    ...inventory,
    ...organization,
    ...usage,
  };

  if (images?.gallery?.length) payload.gallery = images.gallery;
  if (badges.length) payload.badges = badges;
  else delete payload.badges;
  if (v.status === 'SCHEDULED' && v.publishAt) {
    payload.publishAt = new Date(v.publishAt).toISOString();
  }

  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) delete payload[key];
  }
  return payload;
}

/**
 * The update (PATCH) body. Identical to the create body except stock is
 * create-only — subsequent stock changes go through the Inventory module, never
 * a product edit — so `stockQty` is never sent on update.
 */
export function productFormToUpdatePayload(v: ProductFormValues): Record<string, unknown> {
  const payload = productFormToCreatePayload(v);
  delete payload.stockQty;
  // The create builder OMITS empty collections (absent = "default to empty",
  // fine for create). But the backend UPDATE replaces a collection only when its
  // key is present — an omitted key means "leave untouched". So on update, any
  // collection cleared to empty must be sent as [] or the removal won't persist
  // (and, for gallery, would leave rows pointing at already-deleted assets).
  for (const key of ['gallery', 'badges', 'concernIds', 'categoryIds', 'skinTypes', 'tags', 'ingredients', 'benefitItems', 'howToUse']) {
    if (!(key in payload)) payload[key] = [];
  }
  // NOTE: clearing an optional SCALAR (compare-at, cost, HSN, sale window) on
  // edit is not yet supported — sending null needs the backend DTO/service to
  // treat null as "clear" (today new Date(null) would corrupt to the epoch and
  // @IsInt+implicit-conversion could coerce null→0). Tracked as FF-16.
  return payload;
}
