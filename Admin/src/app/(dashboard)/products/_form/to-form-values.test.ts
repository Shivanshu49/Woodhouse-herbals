/**
 * Unit tests for productToFormValues (edit prefill) — the INVERSE of the create
 * mapper. The centerpiece is a round-trip property test: a maximal product,
 * create-payload → (simulated DB detail) → productToFormValues → update-payload,
 * must equal the original create-payload (minus the create-only stockQty). If
 * load→save-without-changes diffs, the edit page silently mutates products.
 * Run alone: npx tsx --test "src/app/(dashboard)/products/_form/to-form-values.test.ts"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { productToFormValues, isoToDatetimeLocal } from './to-form-values';
import { productFormToCreatePayload, productFormToUpdatePayload } from './to-create-payload';
import { DEFAULT_PRODUCT_FORM_VALUES, type ProductFormValues } from './product-form-schema';
import type { ProductDetail } from '@/types/product';

function form(over: Partial<ProductFormValues>): ProductFormValues {
  return { ...DEFAULT_PRODUCT_FORM_VALUES, ...over };
}

/** A maximal form — every field populated, so the round-trip exercises all of them. */
const MAXIMAL = form({
  name: 'Vitamin C Serum',
  slug: 'vitamin-c-serum',
  sku: 'WHH-VC-30',
  shortDescription: 'Brightening serum',
  longDescription: '<p>Full description.</p>',
  status: 'PUBLISHED',
  featured: true,
  bestSeller: true,
  images: [
    { url: 'https://res.cloudinary.com/x/image/upload/v1/woodhouse/products/main.jpg', publicId: 'woodhouse/products/main', alt: 'Main' },
    { url: 'https://res.cloudinary.com/x/image/upload/v1/woodhouse/products/g1.jpg', publicId: 'woodhouse/products/g1', alt: 'Gallery 1', width: 800, height: 600 },
  ],
  price: '199.5',
  compareAtPrice: '299',
  costPrice: '80',
  gstRate: 'GST_18',
  hsnCode: '3304',
  saleStartsAt: '2099-01-01T00:00',
  saleEndsAt: '2099-02-01T00:00',
  trackInventory: true,
  stockQty: '100',
  lowStockThreshold: '10',
  allowBackorder: true,
  weightGrams: '250',
  lengthCm: '12.5',
  widthCm: '8',
  heightCm: '5',
  shippingClass: 'standard',
  freeShipping: true,
  category: 'SERUM',
  categoryIds: ['cat_1', 'cat_2'],
  concernIds: ['con_acne', 'con_aging'],
  skinTypes: ['OILY', 'ALL'],
  tags: ['vegan', 'herbal'],
  badges: [{ label: 'New', tone: 'NEW' }],
  ingredients: [
    { name: 'Niacinamide', benefit: 'Brightens' },
    { name: 'Vit C', benefit: 'Antioxidant' },
  ],
  benefits: ['Glows', 'Softens'],
  howToUse: ['Apply AM', 'Rinse'],
  inciText: 'Aqua, Niacinamide',
  usageFrequency: 'Twice daily',
  recommendedTime: 'Morning & night',
  parabenFree: true,
  sulfateFree: true,
  crueltyFree: true,
  vegan: true,
  alcoholFree: true,
});

/** Model what the backend stores + returns for a create payload (GET /:id shape). */
function mockDetail(cp: Record<string, unknown>): ProductDetail {
  const n = (x: unknown) => (typeof x === 'number' ? x : null);
  const s = (x: unknown) => (typeof x === 'string' ? x : null);
  return {
    id: 'p1',
    name: cp.name as string,
    slug: cp.slug as string,
    sku: cp.sku as string,
    shortDescription: cp.shortDescription as string,
    longDescription: cp.longDescription as string,
    category: cp.category as ProductDetail['category'],
    priceMinor: cp.priceMinor as number,
    compareAtPriceMinor: n(cp.compareAtPriceMinor),
    costPriceMinor: n(cp.costPriceMinor),
    gstRate: s(cp.gstRate),
    hsnCode: s(cp.hsnCode),
    saleStartsAt: s(cp.saleStartsAt),
    saleEndsAt: s(cp.saleEndsAt),
    status: cp.status as ProductDetail['status'],
    publishAt: s(cp.publishAt),
    featured: cp.featured as boolean,
    thumbnailUrl: cp.thumbnailUrl as string,
    thumbnailAlt: cp.thumbnailAlt as string,
    stockQty: (cp.stockQty as number) ?? 0,
    lowStockThreshold: n(cp.lowStockThreshold),
    allowBackorder: cp.allowBackorder as boolean,
    trackInventory: cp.trackInventory as boolean,
    weightGrams: n(cp.weightGrams),
    lengthCm: n(cp.lengthCm),
    widthCm: n(cp.widthCm),
    heightCm: n(cp.heightCm),
    shippingClass: s(cp.shippingClass),
    freeShipping: cp.freeShipping as boolean,
    inciText: s(cp.inciText),
    usageFrequency: s(cp.usageFrequency),
    recommendedTime: s(cp.recommendedTime),
    parabenFree: cp.parabenFree as boolean,
    sulfateFree: cp.sulfateFree as boolean,
    crueltyFree: cp.crueltyFree as boolean,
    vegan: cp.vegan as boolean,
    alcoholFree: cp.alcoholFree as boolean,
    tags: (cp.tags as string[]) ?? [],
    skinTypes: (cp.skinTypes as string[]) ?? [],
    howToUse: (cp.howToUse as string[]) ?? [],
    updatedAt: '2026-07-04T00:00:00.000Z',
    gallery: ((cp.gallery as { url: string; alt: string; sortOrder: number; width?: number; height?: number }[]) ?? []).map((g, i) => ({
      id: `g${i}`,
      url: g.url,
      alt: g.alt,
      width: g.width ?? null,
      height: g.height ?? null,
      sortOrder: g.sortOrder,
    })),
    ingredients: ((cp.ingredients as { name: string; benefit: string; sortOrder: number }[]) ?? []).map((x, i) => ({
      id: `i${i}`,
      name: x.name,
      benefit: x.benefit,
      sortOrder: x.sortOrder,
    })),
    benefitItems: ((cp.benefitItems as { text: string; sortOrder: number }[]) ?? []).map((x, i) => ({ id: `b${i}`, text: x.text, sortOrder: x.sortOrder })),
    badges: ((cp.badges as { label: string; tone: string }[]) ?? []).map((x, i) => ({ id: `bd${i}`, label: x.label, tone: x.tone })),
    concerns: ((cp.concernIds as string[]) ?? []).map((concernId) => ({ concernId })),
    categoryLinks: ((cp.categoryIds as string[]) ?? []).map((categoryId, i) => ({ categoryId, isPrimary: i === 0 })),
  };
}

test('ROUND TRIP: load → edit → save-without-changes produces an identical payload (no silent mutation)', () => {
  const createPayload = productFormToCreatePayload(MAXIMAL);
  const detail = mockDetail(createPayload);
  const reloaded = productToFormValues(detail);
  const updatePayload = productFormToUpdatePayload(reloaded);

  const expected = { ...createPayload };
  delete expected.stockQty; // update never sends stock (create-only)
  assert.deepEqual(updatePayload, expected);
});

test('CLEAR TO EMPTY: removing all items of a collection sends [] on update, so the backend clears it', () => {
  // The backend UPDATE replaces a collection only when its key is PRESENT; an
  // omitted key means "leave untouched". So clearing a collection must send [].
  const reloaded = productToFormValues(mockDetail(productFormToCreatePayload(MAXIMAL)));
  const emptied = {
    ...reloaded,
    images: reloaded.images.slice(0, 1), // keep the required main image → gallery empty
    badges: [],
    bestSeller: false, // else the create-mapper re-adds a Bestseller badge
    concernIds: [],
    categoryIds: [],
    skinTypes: [],
    tags: [],
    ingredients: [],
    benefits: [],
    howToUse: [],
  };
  const upd = productFormToUpdatePayload(emptied);
  for (const k of ['gallery', 'badges', 'concernIds', 'categoryIds', 'skinTypes', 'tags', 'ingredients', 'benefitItems', 'howToUse']) {
    assert.deepEqual(upd[k], [], `${k} must be sent as [] on update so the backend clears it`);
  }
});

test('prefill: gstRate is read from the detail, not hardcoded to the default', () => {
  const detail = mockDetail(productFormToCreatePayload(form({ price: '99', category: 'SERUM', gstRate: 'EXEMPT' })));
  assert.equal(productToFormValues(detail).gstRate, 'EXEMPT');
});

test('prefill: the Bestseller badge is represented ONLY by the toggle (not duplicated in the badges list)', () => {
  const detail = mockDetail(productFormToCreatePayload(form({ price: '99', category: 'SERUM', badges: [{ label: 'New', tone: 'NEW' }], bestSeller: true })));
  const f = productToFormValues(detail);
  assert.equal(f.bestSeller, true);
  assert.deepEqual(f.badges, [{ label: 'New', tone: 'NEW' }]); // BESTSELLER filtered out
});

test('isoToDatetimeLocal inverts new Date(local).toISOString() (round-trips the wall clock)', () => {
  for (const local of ['2099-01-01T00:00', '2030-06-15T09:30', '2027-12-31T23:45']) {
    const iso = new Date(local).toISOString();
    assert.equal(new Date(isoToDatetimeLocal(iso)).toISOString(), iso);
  }
});

test('prefill: paise→rupees, thumbnail+gallery→images, benefitItems→benefits, links→ids', () => {
  const detail = mockDetail(productFormToCreatePayload(MAXIMAL));
  const f = productToFormValues(detail);
  assert.equal(f.price, '199.5'); // 19950 paise
  assert.equal(f.compareAtPrice, '299');
  assert.equal(f.images.length, 2);
  assert.equal(f.images[0].url, 'https://res.cloudinary.com/x/image/upload/v1/woodhouse/products/main.jpg');
  assert.equal(f.images[0].publicId, 'woodhouse/products/main'); // extracted from the Cloudinary URL
  assert.deepEqual(f.benefits, ['Glows', 'Softens']);
  assert.deepEqual(f.concernIds, ['con_acne', 'con_aging']);
  assert.deepEqual(f.categoryIds, ['cat_1', 'cat_2']); // primary first
  assert.equal(f.bestSeller, true); // inferred from the BESTSELLER badge
  assert.equal(f.stockQty, '100');
});

test('prefill: a legacy (non-woodhouse) image url keeps the url as its id so delete-on-remove skips it', () => {
  const detail = mockDetail(productFormToCreatePayload(form({ price: '199', category: 'SERUM', images: [] })));
  detail.thumbnailUrl = 'https://images.unsplash.com/photo-123.jpg';
  detail.thumbnailAlt = 'Seed image';
  const f = productToFormValues(detail);
  assert.equal(f.images[0].url, 'https://images.unsplash.com/photo-123.jpg');
  assert.equal(f.images[0].publicId, 'https://images.unsplash.com/photo-123.jpg'); // not a woodhouse id → won't be destroyed
});

test('prefill: an image-less draft (blank thumbnail) yields no images', () => {
  const detail = mockDetail(productFormToCreatePayload(form({ status: 'DRAFT', images: [], price: '99', category: 'CREAM' })));
  assert.equal(detail.thumbnailUrl, '');
  assert.deepEqual(productToFormValues(detail).images, []);
});
