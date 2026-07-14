/**
 * Production-hazard regression guard for the live-catalog keystone.
 *
 * Once the catalog is live, the storefront must NEVER silently fall back to
 * bundled mock data: a fake product id 404s at `POST /cart/items`, and a
 * fictional price shown to a real customer is worse than an honest error. This
 * suite pins that invariant at the source level (the test harness is
 * `node:test` via tsx — no DOM — so it asserts on source, not render):
 *
 *   1. The three phantom-bearing mock modules are DELETED and stay deleted.
 *   2. No surviving source re-imports them (the fallback that cannot be served
 *      is the one that does not exist).
 *   3. `useCatalog` / `useHomepage` carry no `withFallback` / `initialData` /
 *      mock-catalog import — an outage yields isLoading/isError, never rows.
 *   4. The bestseller adapter carries the REAL DB id through to add-to-cart.
 *
 * Run alone:  npx tsx --test src/hooks/catalog-hazard.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { toBestseller } from '../lib/bestseller';
import type { ProductSummary } from '../types';

const SRC = join(process.cwd(), 'src');

const DELETED_MODULES = [
  'src/data/products.ts',
  'src/data/homepage.ts',
  'src/data/bestsellers.ts',
];

/** Strip comments so the guard asserts on CODE, not on explanatory prose that
 *  legitimately names `withFallback` / `initialData` when documenting their
 *  absence. Leaves `https://` intact (the `[^:]` before `//`). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Every `.ts`/`.tsx` file under src/, excluding this test. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

// ---------------------------------------------------------- deleted for good

test('the phantom-bearing mock modules are deleted', () => {
  for (const rel of DELETED_MODULES) {
    assert.equal(existsSync(join(process.cwd(), rel)), false, `${rel} must not exist`);
  }
});

test('no surviving source imports a deleted mock-catalog module', () => {
  // Match any specifier that RESOLVES to one of the deleted modules, regardless
  // of prefix — `@/data/products`, `./products`, `../../data/products`, etc. We
  // key on the module basename immediately followed by a closing quote so a
  // prose mention like "data/products.ts" (ends in .ts) does not false-match.
  const bases = [
    '/data/products', '/data/homepage', '/data/bestsellers', // @/data/… and ../…/data/…
    './products', './homepage', './bestsellers', // same-dir relative from within src/data/
  ];
  const offenders: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const base of bases) {
      if (text.includes(`${base}'`) || text.includes(`${base}"`)) {
        offenders.push(`${file} → …${base}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `mock-catalog import re-introduced:\n${offenders.join('\n')}`);
});

// ------------------------------------------------- no fallback in the hooks

for (const hook of ['use-catalog.ts', 'use-homepage.ts']) {
  test(`${hook} has no mock fallback, no initialData, no data-mock import`, () => {
    const code = stripComments(readFileSync(join(SRC, 'hooks', hook), 'utf8'));
    assert.equal(/withFallback/.test(code), false, 'withFallback must be gone');
    assert.equal(/initialData/.test(code), false, 'initialData must be gone');
    assert.equal(/@\/data\/(products|homepage|bestsellers)/.test(code), false, 'no mock-catalog import');
  });
}

// ------------------------------------------- adapter carries the real DB id

test('toBestseller carries the live DB id through to add-to-cart', () => {
  const live: ProductSummary = {
    id: 'clz9f8live00cuid', // a real DB cuid, NOT a p_* mock id
    slug: 'neem-face-wash',
    name: 'Neem Face Wash',
    shortDescription: 'Clarifying neem + niacinamide daily wash.',
    price: { amount: 34900, currency: 'INR' },
    compareAtPrice: { amount: 39900, currency: 'INR' },
    thumbnail: { url: 'https://res.cloudinary.com/j5gjlpct/x/1', alt: 'Neem Face Wash' },
    rating: 4.6,
    reviewCount: 128,
    badges: [{ label: 'Bestseller', tone: 'bestseller' }],
    category: 'face-wash',
    concerns: ['acne'],
    skinTypes: ['oily'],
    inStock: true,
  };

  const card = toBestseller(live);

  // The add-to-cart button keys off `.summary`, so its id must be the live id.
  assert.equal(card.summary.id, 'clz9f8live00cuid');
  assert.equal(card.slug, 'neem-face-wash');
  assert.equal(card.price, 349); // whole rupees from paise
  assert.equal(card.compareAtPrice, 399);
  assert.equal(card.image, 'https://res.cloudinary.com/j5gjlpct/x/1');
  // No size on a ProductSummary → empty, so the card hides the separator.
  assert.equal(card.size, '');
  assert.equal(card.ingredientLine, live.shortDescription);
});
