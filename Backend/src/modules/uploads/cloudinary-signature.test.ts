/**
 * Pure unit tests for the Cloudinary signature. No Prisma, no IO, no env.
 * Vectors precomputed with: printf '%s' '<sorted-params><secret>' | sha1sum
 * Run this file alone: npx tsx --test src/modules/uploads/cloudinary-signature.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { signCloudinaryParams } from './cloudinary-signature';

const SECRET = 's3cr3t-api-secret';

test('signs sorted key=value pairs joined with & plus the secret (sha1 hex)', () => {
  assert.equal(
    signCloudinaryParams({ folder: 'woodhouse/products', timestamp: 1700000000 }, SECRET),
    'd095c6d5d9474004627e4be1f3d4eeec3c15fcb2',
  );
  assert.equal(
    signCloudinaryParams({ folder: 'woodhouse/banners', timestamp: 1700000000 }, SECRET),
    '1d5eac9aa24fc7952db7a48199044e85c8e42a4c',
  );
});

test('parameter order does not matter (keys are sorted)', () => {
  assert.equal(
    signCloudinaryParams({ timestamp: 1700000000, folder: 'woodhouse/products' }, SECRET),
    signCloudinaryParams({ folder: 'woodhouse/products', timestamp: 1700000000 }, SECRET),
  );
});

test('undefined and empty params are excluded from the signature', () => {
  assert.equal(
    signCloudinaryParams(
      { folder: 'woodhouse/products', timestamp: 1700000000, eager: undefined, tags: '' },
      SECRET,
    ),
    'd095c6d5d9474004627e4be1f3d4eeec3c15fcb2',
  );
});
