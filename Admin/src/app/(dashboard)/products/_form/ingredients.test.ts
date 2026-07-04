/**
 * Unit tests for the Ingredients & Usage helpers: row classification (blank /
 * partial / complete) and the payload mapping (filter blanks, trim, sortOrder,
 * benefits→benefitItems, omit empties, always send the free-from flags).
 * Run alone: npx tsx --test "src/app/(dashboard)/products/_form/ingredients.test.ts"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ingredientRowState, ingredientsUsageToPayload } from './ingredients';

test('ingredientRowState: blank / partial / complete', () => {
  assert.equal(ingredientRowState({ name: '', benefit: '' }), 'blank');
  assert.equal(ingredientRowState({ name: '  ', benefit: ' ' }), 'blank');
  assert.equal(ingredientRowState({ name: 'Niacinamide', benefit: '' }), 'partial');
  assert.equal(ingredientRowState({ name: '', benefit: 'Brightens' }), 'partial');
  assert.equal(ingredientRowState({ name: 'Niacinamide', benefit: 'Brightens' }), 'complete');
});

const flags = {
  parabenFree: true,
  sulfateFree: false,
  crueltyFree: true,
  vegan: true,
  alcoholFree: false,
};

test('ingredientsUsageToPayload: filters blanks, trims, re-indexes sortOrder, maps benefits→benefitItems', () => {
  const out = ingredientsUsageToPayload({
    ingredients: [
      { name: 'Niacinamide', benefit: 'Brightens' },
      { name: '', benefit: '' }, // blank → dropped
      { name: '  Vit C ', benefit: ' Antioxidant ' },
    ],
    benefits: ['Hydrates', '', 'Softens'],
    howToUse: ['Apply to damp skin', '   '],
    inciText: '  Aqua, Niacinamide  ',
    usageFrequency: 'Twice daily',
    recommendedTime: '',
    ...flags,
  });
  assert.deepEqual(out.ingredients, [
    { name: 'Niacinamide', benefit: 'Brightens', sortOrder: 0 },
    { name: 'Vit C', benefit: 'Antioxidant', sortOrder: 1 },
  ]);
  assert.deepEqual(out.benefitItems, [
    { text: 'Hydrates', sortOrder: 0 },
    { text: 'Softens', sortOrder: 1 },
  ]);
  assert.deepEqual(out.howToUse, ['Apply to damp skin']);
  assert.equal(out.inciText, 'Aqua, Niacinamide');
  assert.equal(out.usageFrequency, 'Twice daily');
  assert.ok(!('recommendedTime' in out));
  assert.equal(out.parabenFree, true);
  assert.equal(out.sulfateFree, false);
  assert.equal(out.vegan, true);
});

test('ingredientsUsageToPayload: omits all empty arrays/text, always sends the 5 flags', () => {
  const out = ingredientsUsageToPayload({
    ingredients: [{ name: '', benefit: '' }],
    benefits: [''],
    howToUse: ['   '],
    inciText: '',
    usageFrequency: '',
    recommendedTime: '',
    parabenFree: false,
    sulfateFree: false,
    crueltyFree: false,
    vegan: false,
    alcoholFree: false,
  });
  assert.deepEqual(out, {
    parabenFree: false,
    sulfateFree: false,
    crueltyFree: false,
    vegan: false,
    alcoholFree: false,
  });
});

test('ingredientsUsageToPayload: a partial row is still mapped (schema blocks it separately)', () => {
  // Payload mapping keeps a name-only row (trims); the schema is what rejects
  // partial rows — the mapper is only reached once validation passes.
  const out = ingredientsUsageToPayload({
    ingredients: [{ name: 'Retinol', benefit: '' }],
    benefits: [],
    howToUse: [],
    inciText: '',
    usageFrequency: '',
    recommendedTime: '',
    ...flags,
  });
  assert.deepEqual(out.ingredients, [{ name: 'Retinol', benefit: '', sortOrder: 0 }]);
});
