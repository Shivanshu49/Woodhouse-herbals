import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCategoryTree, wouldCycle } from './category-tree';

test('buildCategoryTree nests + sorts children under parents', () => {
  const flat = [
    { id: 'b', parentId: null, sortOrder: 2, name: 'B' },
    { id: 'a', parentId: null, sortOrder: 1, name: 'A' },
    { id: 'a2', parentId: 'a', sortOrder: 2, name: 'A2' },
    { id: 'a1', parentId: 'a', sortOrder: 1, name: 'A1' },
  ];
  const tree = buildCategoryTree(flat);
  assert.deepEqual(tree.map((t) => t.id), ['a', 'b']); // roots sorted by sortOrder
  assert.deepEqual(tree[0].children.map((c) => c.id), ['a1', 'a2']); // children sorted
  assert.equal(tree[1].children.length, 0);
});

test('buildCategoryTree promotes orphans (missing parent) to roots', () => {
  const flat = [{ id: 'x', parentId: 'ghost', sortOrder: 1, name: 'X' }];
  const tree = buildCategoryTree(flat);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].id, 'x');
});

test('wouldCycle catches self-parenting and descendant-parenting', () => {
  const flat = [
    { id: 'a', parentId: null, sortOrder: 1 },
    { id: 'b', parentId: 'a', sortOrder: 1 },
    { id: 'c', parentId: 'b', sortOrder: 1 },
  ];
  assert.equal(wouldCycle(flat, 'a', 'a'), true); // self
  assert.equal(wouldCycle(flat, 'a', 'c'), true); // c is a descendant of a
  assert.equal(wouldCycle(flat, 'c', 'a'), false); // moving c under a is fine
});
