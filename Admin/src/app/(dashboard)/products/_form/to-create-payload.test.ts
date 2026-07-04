/**
 * Unit tests for productFormToCreatePayload — the full form → POST /admin/products
 * body assembly that ties every section's *ToPayload helper + the core fields
 * together (GROUP 7). Run alone:
 *   npx tsx --test "src/app/(dashboard)/products/_form/to-create-payload.test.ts"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { productFormToCreatePayload } from './to-create-payload';
import { DEFAULT_PRODUCT_FORM_VALUES, type ProductFormValues } from './product-form-schema';

function form(over: Partial<ProductFormValues>): ProductFormValues {
  return { ...DEFAULT_PRODUCT_FORM_VALUES, ...over };
}
const mainImage = {
  url: 'https://res.cloudinary.com/x/image/upload/woodhouse/products/main.jpg',
  publicId: 'woodhouse/products/main',
  alt: 'Main shot',
};

test('assembles core + every section into one create body', () => {
  const p = productFormToCreatePayload(
    form({
      name: '  Vitamin C Serum ',
      slug: 'vitamin-c-serum',
      sku: ' WHH-VC ',
      shortDescription: ' Bright ',
      longDescription: '<p>Full</p>',
      status: 'PUBLISHED',
      featured: true,
      images: [mainImage, { url: 'https://r/g.jpg', publicId: 'woodhouse/products/g', alt: 'G' }],
      price: '199',
      gstRate: 'GST_18',
      category: 'SERUM',
      concernIds: ['con_acne'],
      trackInventory: true,
      stockQty: '100',
      ingredients: [{ name: 'Niacinamide', benefit: 'Brightens' }],
      benefits: ['Glows'],
      vegan: true,
    }),
  );
  assert.equal(p.name, 'Vitamin C Serum'); // trimmed
  assert.equal(p.sku, 'WHH-VC');
  assert.equal(p.shortDescription, 'Bright');
  assert.equal(p.longDescription, '<p>Full</p>');
  assert.equal(p.status, 'PUBLISHED');
  assert.equal(p.featured, true);
  assert.equal(p.thumbnailUrl, mainImage.url);
  assert.equal(p.thumbnailAlt, 'Main shot');
  assert.deepEqual(p.gallery, [{ url: 'https://r/g.jpg', alt: 'G', sortOrder: 0 }]);
  assert.equal(p.priceMinor, 19900);
  assert.equal(p.gstRate, 'GST_18');
  assert.equal(p.category, 'SERUM');
  assert.deepEqual(p.concernIds, ['con_acne']);
  assert.equal(p.trackInventory, true);
  assert.equal(p.stockQty, 100);
  assert.deepEqual(p.ingredients, [{ name: 'Niacinamide', benefit: 'Brightens', sortOrder: 0 }]);
  assert.deepEqual(p.benefitItems, [{ text: 'Glows', sortOrder: 0 }]);
  assert.equal(p.vegan, true);
});

test('image-less DRAFT sends an empty thumbnail (NOT NULL column) and no gallery', () => {
  const p = productFormToCreatePayload(form({ status: 'DRAFT', images: [], price: '149', category: 'CREAM' }));
  assert.equal(p.thumbnailUrl, '');
  assert.equal(p.thumbnailAlt, '');
  assert.ok(!('gallery' in p));
  assert.equal(p.status, 'DRAFT');
  assert.equal(p.priceMinor, 14900);
});

test('bestSeller appends a Bestseller badge, deduped by tone; off → no badges', () => {
  const on = productFormToCreatePayload(form({ bestSeller: true, price: '199', category: 'SERUM', images: [mainImage] }));
  assert.deepEqual(on.badges, [{ label: 'Bestseller', tone: 'BESTSELLER' }]);

  const existing = productFormToCreatePayload(
    form({ bestSeller: true, badges: [{ label: 'Top pick', tone: 'BESTSELLER' }], price: '199', category: 'SERUM', images: [mainImage] }),
  );
  assert.deepEqual(existing.badges, [{ label: 'Top pick', tone: 'BESTSELLER' }]); // not duplicated

  const off = productFormToCreatePayload(form({ bestSeller: false, price: '199', category: 'SERUM', images: [mainImage] }));
  assert.ok(!('badges' in off));
});

test('SCHEDULED includes an ISO publishAt; other statuses omit it', () => {
  const sched = productFormToCreatePayload(
    form({ status: 'SCHEDULED', publishAt: '2099-01-01T00:00', price: '199', category: 'SERUM', images: [mainImage] }),
  );
  assert.equal(sched.publishAt, new Date('2099-01-01T00:00').toISOString());
  const pub = productFormToCreatePayload(form({ status: 'PUBLISHED', publishAt: '', price: '199', category: 'SERUM', images: [mainImage] }));
  assert.ok(!('publishAt' in pub));
});

test('uses backend field names — no form-only key leaks into the payload', () => {
  const p = productFormToCreatePayload(
    form({
      price: '199',
      compareAtPrice: '249',
      costPrice: '80',
      images: [mainImage],
      benefits: ['Glows'],
      bestSeller: true,
      category: 'SERUM',
    }),
  );
  // These are FORM-only fields with different backend names (or none) — a leak
  // would send an unknown property the backend rejects with a 400.
  for (const formOnly of ['price', 'compareAtPrice', 'costPrice', 'images', 'benefits', 'bestSeller']) {
    assert.ok(!(formOnly in p), `form-only key "${formOnly}" must not be in the payload`);
  }
  // …and the corresponding backend fields ARE present.
  assert.equal(p.priceMinor, 19900);
  assert.equal(p.compareAtPriceMinor, 24900);
  assert.equal(p.costPriceMinor, 8000);
  assert.equal(p.thumbnailUrl, mainImage.url);
  assert.deepEqual(p.benefitItems, [{ text: 'Glows', sortOrder: 0 }]);
  assert.ok(Array.isArray(p.badges)); // bestSeller → a Bestseller badge
});

test('includes every field CreateProductDto requires', () => {
  const p = productFormToCreatePayload(form({ price: '199', category: 'SERUM', images: [mainImage] }));
  for (const required of [
    'name',
    'slug',
    'sku',
    'shortDescription',
    'longDescription',
    'category',
    'priceMinor',
    'thumbnailUrl',
    'thumbnailAlt',
  ]) {
    assert.ok(required in p, `required DTO field "${required}" missing from the payload`);
  }
});

test('always sends the required scalars + free-from flags; omits empty optionals', () => {
  const p = productFormToCreatePayload(form({ price: '199', category: 'SERUM', images: [mainImage] }));
  assert.equal(typeof p.priceMinor, 'number');
  assert.equal(p.gstRate, 'GST_18');
  assert.equal(p.trackInventory, true);
  assert.equal(p.parabenFree, false);
  assert.equal(p.vegan, false);
  assert.ok(!('compareAtPriceMinor' in p)); // blank optional
  assert.ok(!('tags' in p)); // empty array omitted
  assert.ok(!('ingredients' in p)); // empty array omitted
});
