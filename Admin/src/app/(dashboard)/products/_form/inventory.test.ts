/**
 * Unit tests for the inventory/shipping helpers. Stock counts and weight are
 * whole non-negative integers (grams for weight); dimensions allow decimals.
 * Range (INT_MAX) is enforced by the schema, not these parsers.
 * Run alone: npx tsx --test "src/app/(dashboard)/products/_form/inventory.test.ts"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCount, parseDimension, inventoryToPayload } from './inventory';

test('parseCount: non-negative whole numbers, commas/whitespace tolerated', () => {
  assert.equal(parseCount('50'), 50);
  assert.equal(parseCount('0'), 0);
  assert.equal(parseCount('1,000'), 1000);
  assert.equal(parseCount('  25  '), 25);
});

test('parseCount: rejects decimals, negatives, and junk (a count is a whole number)', () => {
  assert.equal(parseCount('50.5'), null);
  assert.equal(parseCount('-1'), null);
  assert.equal(parseCount('abc'), null);
  assert.equal(parseCount(''), null);
});

test('parseDimension: non-negative decimals up to 2 places', () => {
  assert.equal(parseDimension('12'), 12);
  assert.equal(parseDimension('12.5'), 12.5);
  assert.equal(parseDimension('12.55'), 12.55);
  assert.equal(parseDimension('0'), 0);
});

test('parseDimension: rejects >2 decimals, negatives, junk', () => {
  assert.equal(parseDimension('12.555'), null);
  assert.equal(parseDimension('-1'), null);
  assert.equal(parseDimension('abc'), null);
  assert.equal(parseDimension(''), null);
});

const fullInput = {
  trackInventory: true,
  stockQty: '100',
  lowStockThreshold: '10',
  allowBackorder: false,
  weightGrams: '250',
  lengthCm: '12',
  widthCm: '8',
  heightCm: '5.5',
  shippingClass: 'standard',
  freeShipping: false,
};

test('inventoryToPayload: maps counts/dimensions and always sends the boolean flags', () => {
  assert.deepEqual(inventoryToPayload(fullInput), {
    trackInventory: true,
    allowBackorder: false,
    freeShipping: false,
    stockQty: 100,
    lowStockThreshold: 10,
    weightGrams: 250,
    lengthCm: 12,
    widthCm: 8,
    heightCm: 5.5,
    shippingClass: 'standard',
  });
});

test('inventoryToPayload: weight maps to the explicit `weightGrams` key (never a bare number)', () => {
  const out = inventoryToPayload({ ...fullInput, weightGrams: '50' });
  assert.equal(out.weightGrams, 50);
  assert.ok('weightGrams' in out);
});

test('inventoryToPayload: when tracking is OFF, stock fields are omitted (not applicable)', () => {
  const out = inventoryToPayload({ ...fullInput, trackInventory: false });
  assert.equal(out.trackInventory, false);
  assert.ok(!('stockQty' in out));
  assert.ok(!('lowStockThreshold' in out));
  // shipping still flows through
  assert.equal(out.weightGrams, 250);
});

test('inventoryToPayload: shippingClass is trimmed on output; whitespace-only is omitted', () => {
  assert.equal(inventoryToPayload({ ...fullInput, shippingClass: '  standard  ' }).shippingClass, 'standard');
  assert.ok(!('shippingClass' in inventoryToPayload({ ...fullInput, shippingClass: '   ' })));
});

test('inventoryToPayload: blank optional fields are omitted', () => {
  const out = inventoryToPayload({
    trackInventory: true,
    stockQty: '',
    lowStockThreshold: '',
    allowBackorder: false,
    weightGrams: '',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    shippingClass: '',
    freeShipping: true,
  });
  assert.deepEqual(out, { trackInventory: true, allowBackorder: false, freeShipping: true });
});
