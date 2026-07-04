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
    ...overrides,
  };
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
