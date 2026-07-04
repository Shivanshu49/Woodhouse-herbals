import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_IMAGE_BYTES, validateImageFile } from './image-upload';

test('accepts a small jpeg', () => {
  assert.equal(validateImageFile({ type: 'image/jpeg', size: 1_000_000 }), null);
});

test('accepts png and webp', () => {
  assert.equal(validateImageFile({ type: 'image/png', size: 500 }), null);
  assert.equal(validateImageFile({ type: 'image/webp', size: 500 }), null);
});

test('rejects an unsupported type (gif)', () => {
  assert.match(validateImageFile({ type: 'image/gif', size: 500 }) ?? '', /JPG, PNG or WebP/);
});

test('rejects a non-image type', () => {
  assert.match(validateImageFile({ type: 'application/pdf', size: 500 }) ?? '', /Unsupported/);
});

test('rejects a file over 5 MB', () => {
  assert.match(validateImageFile({ type: 'image/jpeg', size: MAX_IMAGE_BYTES + 1 }) ?? '', /under 5 MB/);
});

test('accepts a file exactly at the 5 MB limit', () => {
  assert.equal(validateImageFile({ type: 'image/jpeg', size: MAX_IMAGE_BYTES }), null);
});
