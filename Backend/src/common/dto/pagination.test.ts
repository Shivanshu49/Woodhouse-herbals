/**
 * Pure unit tests for pagination math. No Prisma, no IO.
 * Run this file alone: npx tsx --test src/common/dto/pagination.test.ts
 */
import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { pageArgs } from './pagination.dto';

test('defaults to page 1, 25 per page', () => {
  assert.deepEqual(pageArgs({}), { skip: 0, take: 25, page: 1, perPage: 25 });
});

test('computes skip from page and perPage', () => {
  assert.deepEqual(pageArgs({ page: 3, perPage: 10 }), { skip: 20, take: 10, page: 3, perPage: 10 });
});

test('first page has zero skip regardless of perPage', () => {
  assert.equal(pageArgs({ page: 1, perPage: 100 }).skip, 0);
});
