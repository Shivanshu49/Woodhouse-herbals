/**
 * Unit tests for the product form schema — GROUP 2 adds the `images` field and
 * the "a main image is required to publish/schedule, optional for a draft" rule.
 * Run alone: npx tsx --test "src/app/(dashboard)/products/_form/product-form-schema.test.ts"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  productFormSchema,
  DEFAULT_PRODUCT_FORM_VALUES,
  type ProductFormValues,
} from './product-form-schema';

/** A far-future datetime-local value so SCHEDULED never trips the date rule. */
const FUTURE = '2099-01-01T00:00';

function base(overrides: Partial<ProductFormValues> = {}): ProductFormValues {
  return {
    name: 'Vitamin C Serum',
    slug: 'vitamin-c-serum',
    sku: 'WHH-VC-30',
    shortDescription: 'Brightening serum',
    longDescription: '<p>Real full description content.</p>',
    status: 'DRAFT',
    publishAt: '',
    featured: false,
    bestSeller: false,
    images: [],
    price: '199',
    compareAtPrice: '',
    costPrice: '',
    gstRate: 'GST_18',
    hsnCode: '',
    saleStartsAt: '',
    saleEndsAt: '',
    trackInventory: true,
    stockQty: '',
    lowStockThreshold: '',
    allowBackorder: false,
    weightGrams: '',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    shippingClass: '',
    freeShipping: false,
    ...overrides,
  };
}

function issueOn(result: ReturnType<typeof productFormSchema.safeParse>, path: string): boolean {
  return !result.success && result.error.issues.some((i) => i.path[0] === path);
}

const img = (over: Partial<ProductFormValues['images'][number]> = {}): ProductFormValues['images'][number] => ({
  url: 'https://res.cloudinary.com/woodhouseherbals/image/upload/v1/woodhouse/products/a.jpg',
  publicId: 'woodhouse/products/a',
  alt: 'Front of the bottle',
  ...over,
});

function imagesIssue(result: ReturnType<typeof productFormSchema.safeParse>): boolean {
  return !result.success && result.error.issues.some((i) => i.path[0] === 'images');
}

test('DRAFT with no images is valid — a main image is optional for a draft', () => {
  assert.equal(productFormSchema.safeParse(base({ status: 'DRAFT', images: [] })).success, true);
});

test('PUBLISHED with no images fails, and the error is on `images`', () => {
  const r = productFormSchema.safeParse(base({ status: 'PUBLISHED', images: [] }));
  assert.equal(r.success, false);
  assert.ok(imagesIssue(r), 'expected an issue on the images path');
});

test('PUBLISHED with a main image is valid', () => {
  assert.equal(productFormSchema.safeParse(base({ status: 'PUBLISHED', images: [img()] })).success, true);
});

test('SCHEDULED with no images fails on `images` (independent of the publish-date rule)', () => {
  const r = productFormSchema.safeParse(base({ status: 'SCHEDULED', images: [], publishAt: FUTURE }));
  assert.equal(r.success, false);
  assert.ok(imagesIssue(r), 'expected an issue on the images path');
});

test('SCHEDULED with a main image and a future publish date is valid', () => {
  assert.equal(
    productFormSchema.safeParse(base({ status: 'SCHEDULED', images: [img()], publishAt: FUTURE })).success,
    true,
  );
});

test('an image entry with a non-URL `url` is rejected', () => {
  const r = productFormSchema.safeParse(
    base({ status: 'DRAFT', images: [img({ url: 'not-a-url' })] }),
  );
  assert.equal(r.success, false);
});

test('multiple images are allowed; the first is the main image', () => {
  const r = productFormSchema.safeParse(
    base({ status: 'PUBLISHED', images: [img({ publicId: 'woodhouse/products/a' }), img({ publicId: 'woodhouse/products/b' })] }),
  );
  assert.equal(r.success, true);
});

test('exactly 12 images is allowed (upper boundary of the cap)', () => {
  const images = Array.from({ length: 12 }, () => img());
  assert.equal(productFormSchema.safeParse(base({ status: 'DRAFT', images })).success, true);
});

test('more than 12 images fails on `images` (the .max(12) cap)', () => {
  const images = Array.from({ length: 13 }, () => img());
  const r = productFormSchema.safeParse(base({ status: 'DRAFT', images }));
  assert.equal(r.success, false);
  assert.ok(imagesIssue(r), 'expected an issue on the images path');
});

test('DEFAULT_PRODUCT_FORM_VALUES starts with an empty images array', () => {
  // The defaults are intentionally-empty placeholders (blank name/sku/etc.), so
  // they do not pass validation — we only assert the media field's starting shape.
  assert.deepEqual(DEFAULT_PRODUCT_FORM_VALUES.images, []);
});

// ── GROUP 3 · Pricing & Tax ──────────────────────────────────────────
test('a valid price passes; an empty price fails on `price`', () => {
  assert.equal(productFormSchema.safeParse(base({ price: '199.50' })).success, true);
  assert.ok(issueOn(productFormSchema.safeParse(base({ price: '' })), 'price'));
});

test('price must be a valid amount greater than zero', () => {
  assert.ok(issueOn(productFormSchema.safeParse(base({ price: '0' })), 'price'));
  assert.ok(issueOn(productFormSchema.safeParse(base({ price: 'abc' })), 'price'));
  assert.ok(issueOn(productFormSchema.safeParse(base({ price: '9.999' })), 'price')); // sub-paise
});

test('compare-at must be higher than the price (hard error)', () => {
  assert.ok(issueOn(productFormSchema.safeParse(base({ price: '199', compareAtPrice: '150' })), 'compareAtPrice'));
  assert.ok(issueOn(productFormSchema.safeParse(base({ price: '199', compareAtPrice: '199' })), 'compareAtPrice')); // equal not allowed
  assert.equal(productFormSchema.safeParse(base({ price: '199', compareAtPrice: '249' })).success, true);
  assert.equal(productFormSchema.safeParse(base({ price: '199', compareAtPrice: '' })).success, true); // optional
});

test('amounts above the 32-bit Int limit are rejected (backend Int column overflows)', () => {
  // INT_MAX paise = 2,147,483,647 → ₹21,474,836.47 is the largest storable amount.
  assert.equal(productFormSchema.safeParse(base({ price: '21474836.47' })).success, true); // == INT_MAX
  assert.ok(issueOn(productFormSchema.safeParse(base({ price: '21474836.48' })), 'price')); // 1 paise over
  assert.ok(issueOn(productFormSchema.safeParse(base({ price: '10000000000' })), 'price')); // fat-finger
  assert.ok(issueOn(productFormSchema.safeParse(base({ price: '199', compareAtPrice: '99999999999' })), 'compareAtPrice'));
  assert.ok(issueOn(productFormSchema.safeParse(base({ costPrice: '99999999999' })), 'costPrice'));
});

test('cost price, when present, must be a valid amount', () => {
  assert.ok(issueOn(productFormSchema.safeParse(base({ costPrice: '12.999' })), 'costPrice'));
  assert.equal(productFormSchema.safeParse(base({ costPrice: '80' })).success, true);
  assert.equal(productFormSchema.safeParse(base({ costPrice: '' })).success, true);
});

test('HSN code, when present, must be 4-8 digits', () => {
  assert.equal(productFormSchema.safeParse(base({ hsnCode: '3304' })).success, true);
  assert.ok(issueOn(productFormSchema.safeParse(base({ hsnCode: '33' })), 'hsnCode'));
  assert.ok(issueOn(productFormSchema.safeParse(base({ hsnCode: '123456789' })), 'hsnCode'));
  assert.ok(issueOn(productFormSchema.safeParse(base({ hsnCode: '33a4' })), 'hsnCode'));
});

test('gstRate accepts the enum values and rejects others', () => {
  assert.equal(productFormSchema.safeParse(base({ gstRate: 'GST_12' })).success, true);
  assert.equal(productFormSchema.safeParse(base({ gstRate: 'EXEMPT' })).success, true);
  assert.equal(productFormSchema.safeParse(base({ gstRate: 'GST_9' as never })).success, false);
});

// ── GROUP 4 · Inventory & Shipping ───────────────────────────────────
test('stockQty: whole number ok; decimals / negatives / over-INT_MAX rejected; blank ok', () => {
  assert.equal(productFormSchema.safeParse(base({ stockQty: '100' })).success, true);
  assert.ok(issueOn(productFormSchema.safeParse(base({ stockQty: '10.5' })), 'stockQty'));
  assert.ok(issueOn(productFormSchema.safeParse(base({ stockQty: '-1' })), 'stockQty'));
  assert.equal(productFormSchema.safeParse(base({ stockQty: '2147483647' })).success, true); // exact INT_MAX
  assert.ok(issueOn(productFormSchema.safeParse(base({ stockQty: '2147483648' })), 'stockQty'));
  assert.equal(productFormSchema.safeParse(base({ stockQty: '' })).success, true);
});

test('stock fields are only validated when tracking is ON (disabled fields must not block submit)', () => {
  // An invalid value left in a now-disabled stock field must not block submit.
  assert.equal(productFormSchema.safeParse(base({ trackInventory: false, stockQty: '10.5' })).success, true);
  assert.equal(productFormSchema.safeParse(base({ trackInventory: false, lowStockThreshold: 'abc' })).success, true);
  // With tracking on, the same value is validated.
  assert.ok(issueOn(productFormSchema.safeParse(base({ trackInventory: true, stockQty: '10.5' })), 'stockQty'));
  // Weight is shipping, not gated by tracking — always validated.
  assert.ok(issueOn(productFormSchema.safeParse(base({ trackInventory: false, weightGrams: '2.5' })), 'weightGrams'));
});

test('lowStockThreshold: optional whole number', () => {
  assert.equal(productFormSchema.safeParse(base({ lowStockThreshold: '5' })).success, true);
  assert.ok(issueOn(productFormSchema.safeParse(base({ lowStockThreshold: '5.5' })), 'lowStockThreshold'));
});

test('weightGrams: optional whole number of grams; over-max rejected', () => {
  assert.equal(productFormSchema.safeParse(base({ weightGrams: '250' })).success, true);
  assert.equal(productFormSchema.safeParse(base({ weightGrams: '2147483647' })).success, true); // exact INT_MAX
  assert.ok(issueOn(productFormSchema.safeParse(base({ weightGrams: '2.5' })), 'weightGrams'));
  assert.ok(issueOn(productFormSchema.safeParse(base({ weightGrams: '9999999999' })), 'weightGrams'));
});

test('dimensions: optional non-negative decimals up to 2 places', () => {
  assert.equal(productFormSchema.safeParse(base({ lengthCm: '12.5', widthCm: '8', heightCm: '5.25' })).success, true);
  assert.ok(issueOn(productFormSchema.safeParse(base({ lengthCm: '12.555' })), 'lengthCm'));
  assert.ok(issueOn(productFormSchema.safeParse(base({ widthCm: '-3' })), 'widthCm'));
});

test('shippingClass: optional, capped length', () => {
  assert.equal(productFormSchema.safeParse(base({ shippingClass: 'cold-chain' })).success, true);
  assert.ok(issueOn(productFormSchema.safeParse(base({ shippingClass: 'x'.repeat(51) })), 'shippingClass'));
});

test('sale window: end must be after start, and an end needs a start', () => {
  assert.equal(
    productFormSchema.safeParse(base({ saleStartsAt: '2099-01-01T00:00', saleEndsAt: '2099-01-10T00:00' })).success,
    true,
  );
  assert.ok(
    issueOn(productFormSchema.safeParse(base({ saleStartsAt: '2099-01-10T00:00', saleEndsAt: '2099-01-01T00:00' })), 'saleEndsAt'),
  );
  assert.ok(issueOn(productFormSchema.safeParse(base({ saleStartsAt: '', saleEndsAt: '2099-01-10T00:00' })), 'saleStartsAt'));
  assert.equal(productFormSchema.safeParse(base({ saleStartsAt: '', saleEndsAt: '' })).success, true);
});
