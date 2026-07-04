/**
 * Unit tests for the media "order-index" rule: the ordered `images` array maps
 * to the backend's main image (thumbnail) + gallery, with each gallery item's
 * sortOrder following its position. Reordering the array reorders the output.
 * Run alone: npx tsx --test "src/app/(dashboard)/products/_form/product-images.test.ts"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { orderedInsertIndex, productImagesToPayload } from './product-images';
import type { ProductImageInput } from './product-form-schema';

const withIds = (...ids: string[]) => ids.map((publicId) => ({ publicId }));

test('orderedInsertIndex: an empty gallery inserts at 0', () => {
  assert.equal(orderedInsertIndex([], 5, new Map()), 0);
});

test('orderedInsertIndex: appends after images with no recorded seq (pre-existing / edit-mode)', () => {
  assert.equal(orderedInsertIndex(withIds('a', 'b'), 3, new Map()), 2);
});

test('orderedInsertIndex: inserts before the first committed image selected later (higher seq)', () => {
  // Files selected a(0), b(1), c(2); b finished last. Inserting b(seq 1) among
  // [a(0), c(2)] must land it before c → index 1, so order stays a,b,c.
  const seqs = new Map([
    ['a', 0],
    ['c', 2],
  ]);
  assert.equal(orderedInsertIndex(withIds('a', 'c'), 1, seqs), 1);
});

test('orderedInsertIndex: appends when every committed image was selected earlier (lower seq)', () => {
  const seqs = new Map([
    ['a', 0],
    ['b', 1],
  ]);
  assert.equal(orderedInsertIndex(withIds('a', 'b'), 2, seqs), 2);
});

const mk = (over: Partial<ProductImageInput>): ProductImageInput => ({
  url: 'https://res.cloudinary.com/x/image/upload/woodhouse/products/x.jpg',
  publicId: 'woodhouse/products/x',
  alt: '',
  ...over,
});

test('no images maps to null (a draft with no main image)', () => {
  assert.equal(productImagesToPayload([]), null);
});

test('a single image becomes the thumbnail with an empty gallery', () => {
  assert.deepEqual(productImagesToPayload([mk({ url: 'u0', publicId: 'p0', alt: 'main' })]), {
    thumbnailUrl: 'u0',
    thumbnailAlt: 'main',
    gallery: [],
  });
});

test('the first image is the thumbnail; the rest form an ordered gallery with sortOrder', () => {
  const images = [
    mk({ url: 'u0', publicId: 'p0', alt: 'main' }),
    mk({ url: 'u1', publicId: 'p1', alt: 'g1', width: 800, height: 600 }),
    mk({ url: 'u2', publicId: 'p2', alt: 'g2' }),
  ];
  assert.deepEqual(productImagesToPayload(images), {
    thumbnailUrl: 'u0',
    thumbnailAlt: 'main',
    gallery: [
      { url: 'u1', alt: 'g1', sortOrder: 0, width: 800, height: 600 },
      { url: 'u2', alt: 'g2', sortOrder: 1 },
    ],
  });
});

test('reordering the array changes which image is the thumbnail and the gallery order', () => {
  const a = mk({ url: 'ua', publicId: 'pa', alt: 'A' });
  const b = mk({ url: 'ub', publicId: 'pb', alt: 'B' });
  assert.equal(productImagesToPayload([a, b])?.thumbnailUrl, 'ua');
  assert.equal(productImagesToPayload([b, a])?.thumbnailUrl, 'ub');
  assert.equal(productImagesToPayload([b, a])?.gallery[0]?.url, 'ua');
  assert.equal(productImagesToPayload([b, a])?.gallery[0]?.sortOrder, 0);
});
