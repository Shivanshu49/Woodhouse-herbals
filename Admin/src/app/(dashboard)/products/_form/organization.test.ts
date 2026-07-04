/**
 * Unit tests for the Organization helpers: the enum option lists, the tag
 * add/dedupe logic, and the payload mapping (relational ids + enums + badges).
 * Run alone: npx tsx --test "src/app/(dashboard)/products/_form/organization.test.ts"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCT_CATEGORY_OPTIONS,
  PRODUCT_CATEGORY_VALUES,
  SKIN_TYPE_VALUES,
  BADGE_TONE_VALUES,
  addTag,
  organizationToPayload,
} from './organization';

test('option lists cover every backend enum value', () => {
  assert.deepEqual(
    [...PRODUCT_CATEGORY_VALUES].sort(),
    ['CREAM', 'COMBO', 'FACE_WASH', 'HAIR_OIL', 'MASK', 'SCRUB', 'SERUM', 'SHAMPOO', 'TONER'].sort(),
  );
  assert.equal(PRODUCT_CATEGORY_OPTIONS.length, PRODUCT_CATEGORY_VALUES.length);
  assert.deepEqual([...SKIN_TYPE_VALUES].sort(), ['ALL', 'COMBINATION', 'DRY', 'NORMAL', 'OILY', 'SENSITIVE'].sort());
  assert.deepEqual([...BADGE_TONE_VALUES].sort(), ['BESTSELLER', 'LIMITED', 'NEW', 'SALE'].sort());
});

test('addTag: trims, ignores empties, dedupes case-insensitively', () => {
  assert.deepEqual(addTag([], 'Vegan'), ['Vegan']);
  assert.deepEqual(addTag(['Vegan'], '  Herbal  '), ['Vegan', 'Herbal']);
  assert.deepEqual(addTag(['Vegan'], 'vegan'), ['Vegan']); // case-insensitive dupe → unchanged
  assert.deepEqual(addTag(['Vegan'], ''), ['Vegan']);
  assert.deepEqual(addTag(['Vegan'], '   '), ['Vegan']);
});

test('addTag: rejects a tag longer than the max (prevents an un-submittable value)', () => {
  assert.deepEqual(addTag([], 'x'.repeat(31)), []); // over max → rejected
  assert.deepEqual(addTag([], 'x'.repeat(30)), ['x'.repeat(30)]); // exactly max → ok
});

const fullOrg = {
  category: 'SERUM' as const,
  categoryIds: ['cat_1', 'cat_2'],
  concernIds: ['con_acne', 'con_aging'],
  skinTypes: ['OILY', 'ALL'] as ('OILY' | 'ALL')[],
  tags: ['vegan', 'herbal'],
  badges: [{ label: 'New', tone: 'NEW' as const }],
};

test('organizationToPayload: passes category + relational ids + enums + badges through', () => {
  assert.deepEqual(organizationToPayload(fullOrg), {
    category: 'SERUM',
    categoryIds: ['cat_1', 'cat_2'],
    concernIds: ['con_acne', 'con_aging'],
    skinTypes: ['OILY', 'ALL'],
    tags: ['vegan', 'herbal'],
    badges: [{ label: 'New', tone: 'NEW' }],
  });
});

test('organizationToPayload: omits empty arrays, always keeps category', () => {
  assert.deepEqual(
    organizationToPayload({
      category: 'CREAM',
      categoryIds: [],
      concernIds: [],
      skinTypes: [],
      tags: [],
      badges: [],
    }),
    { category: 'CREAM' },
  );
});
