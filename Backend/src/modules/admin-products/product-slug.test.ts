/**
 * Pure unit tests for the admin product slugify helper. No Prisma, no IO.
 * Run this file alone: npx tsx --test src/modules/admin-products/product-slug.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from './product-slug';

test('lowercases, trims, and drops a trailing percent sign', () => {
  assert.equal(slugify('Vitamin C Serum 30% '), 'vitamin-c-serum-30');
});

test('collapses runs of whitespace and strips disallowed punctuation', () => {
  assert.equal(slugify('Aloe   & Neem'), 'aloe-neem');
});

test('an already-valid slug is left unchanged', () => {
  assert.equal(slugify('aloe-neem-face-wash'), 'aloe-neem-face-wash');
});

test('underscores become dashes', () => {
  assert.equal(slugify('vit_c_serum'), 'vit-c-serum');
});

test('collapses multiple generated dashes into one', () => {
  assert.equal(slugify('Rice -- Water  Toner'), 'rice-water-toner');
});

test('strips leading and trailing dashes produced by punctuation at the edges', () => {
  assert.equal(slugify('--Neem Face Wash--'), 'neem-face-wash');
});

test('empty string stays empty', () => {
  assert.equal(slugify(''), '');
});
