/**
 * Pure unit tests for audit action derivation. No Prisma, no IO.
 * Run this file alone: npx tsx --test src/common/audit/audit-action.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveAuditAction, deriveEntityType } from './audit-action';

test('kebab-cases the controller stem and appends the handler', () => {
  assert.equal(deriveAuditAction('AdminProductsController', 'update'), 'admin-products.update');
  assert.equal(deriveAuditAction('UploadsController', 'sign'), 'uploads.sign');
});

test('handles single-word controllers', () => {
  assert.equal(deriveAuditAction('CouponsController', 'create'), 'coupons.create');
});

test('entity type is the controller stem', () => {
  assert.equal(deriveEntityType('AdminProductsController'), 'AdminProducts');
  assert.equal(deriveEntityType('UploadsController'), 'Uploads');
});
