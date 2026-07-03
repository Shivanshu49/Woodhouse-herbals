/**
 * Pure unit tests for the query-param boolean parser. No Prisma, no IO,
 * no reflect-metadata — this only exercises the plain function used by
 * ListAdminProductsDto's `deleted` @Transform.
 * Run this file alone: npx tsx --test src/modules/admin-products/parse-bool.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBool } from './parse-bool';

test('"false" string parses to boolean false', () => {
  assert.equal(parseBool('false'), false);
});

test('"true" string parses to boolean true', () => {
  assert.equal(parseBool('true'), true);
});

test('undefined stays undefined', () => {
  assert.equal(parseBool(undefined), undefined);
});

test('"0" parses to false', () => {
  assert.equal(parseBool('0'), false);
});

test('"1" parses to true', () => {
  assert.equal(parseBool('1'), true);
});

test('real boolean false stays false', () => {
  assert.equal(parseBool(false), false);
});

test('real boolean true stays true', () => {
  assert.equal(parseBool(true), true);
});

test('null parses to undefined', () => {
  assert.equal(parseBool(null), undefined);
});

test('empty string parses to false', () => {
  assert.equal(parseBool(''), false);
});
