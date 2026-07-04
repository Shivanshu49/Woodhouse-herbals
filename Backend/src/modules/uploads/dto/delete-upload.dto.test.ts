/**
 * The delete-on-remove safety boundary: only assets under our own
 * `woodhouse/{products|banners|content}/…` folders may be destroyed. This DTO
 * is the guard that stops an admin (or a bug) from deleting an arbitrary
 * Cloudinary public_id. Pure validation — no Nest, no IO.
 * Run alone: npx tsx --test src/modules/uploads/dto/delete-upload.dto.test.ts
 */
// class-transformer's decorators need the metadata reflection polyfill, which
// main.ts loads at bootstrap but a bare test does not.
import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DeleteUploadDto } from './delete-upload.dto';

function constraintsFor(publicId: unknown): string[] {
  const dto = plainToInstance(DeleteUploadDto, { publicId });
  return validateSync(dto).flatMap((e) => Object.values(e.constraints ?? {}));
}
const accepts = (publicId: unknown) =>
  assert.equal(constraintsFor(publicId).length, 0, `expected ACCEPTED: ${String(publicId)}`);
const rejects = (publicId: unknown) =>
  assert.ok(constraintsFor(publicId).length > 0, `expected REJECTED: ${String(publicId)}`);

test('accepts assets under each of the three allowed folders', () => {
  accepts('woodhouse/products/abc123');
  accepts('woodhouse/banners/hero-summer-2026');
  accepts('woodhouse/content/about/team-photo');
});

test('accepts the full set of Cloudinary-legal id characters (letters, digits, . _ - /)', () => {
  accepts('woodhouse/products/a_b-c.d/e1');
});

test('rejects a public_id outside the woodhouse namespace', () => {
  rejects('some/other/asset');
  rejects('cloudinary-sample');
  rejects('products/abc'); // missing the woodhouse/ prefix
});

test('rejects a folder that is not products/banners/content', () => {
  rejects('woodhouse/secrets/api-key');
  rejects('woodhouse/users/avatar');
});

test('rejects the folder root with no asset segment', () => {
  rejects('woodhouse/products');
  rejects('woodhouse/products/');
});

test('rejects prefix-spoofing — woodhouse must be at the very start (anchored)', () => {
  rejects('evil/woodhouse/products/abc');
  rejects(' woodhouse/products/abc'); // leading space
  rejects('x-woodhouse/products/abc');
});

test('rejects an empty / missing public_id', () => {
  rejects('');
  rejects(undefined);
});
