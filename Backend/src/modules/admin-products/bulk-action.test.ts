/**
 * Pure unit tests for resolving admin bulk product actions. No Prisma, no IO.
 * Run this file alone: npx tsx --test src/modules/admin-products/bulk-action.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { resolveBulkAction } from './bulk-action';

const NOW = new Date('2026-07-04T12:00:00.000Z');

test('publish resolves to a PUBLISHED status change', () => {
  assert.deepEqual(resolveBulkAction('publish', undefined, NOW), {
    kind: 'status',
    status: 'PUBLISHED',
  });
});

test('draft resolves to a DRAFT status change', () => {
  assert.deepEqual(resolveBulkAction('draft', undefined, NOW), {
    kind: 'status',
    status: 'DRAFT',
  });
});

test('archive resolves to a soft-delete with the supplied timestamp', () => {
  assert.deepEqual(resolveBulkAction('archive', undefined, NOW), {
    kind: 'soft-delete',
    deletedAt: NOW,
  });
});

test('restore resolves to a soft-delete clear (null deletedAt)', () => {
  assert.deepEqual(resolveBulkAction('restore', undefined, NOW), {
    kind: 'soft-delete',
    deletedAt: null,
  });
});

test('set-category resolves with the given categoryId', () => {
  assert.deepEqual(resolveBulkAction('set-category', 'cat_123', NOW), {
    kind: 'set-category',
    categoryId: 'cat_123',
  });
});

test('set-category without categoryId throws BadRequestException', () => {
  assert.throws(() => resolveBulkAction('set-category', undefined, NOW), BadRequestException);
});

test('an unknown action throws BadRequestException', () => {
  assert.throws(() => resolveBulkAction('nonsense', undefined, NOW), BadRequestException);
});
