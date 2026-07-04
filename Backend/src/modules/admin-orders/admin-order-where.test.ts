/**
 * Pure unit tests for the admin order list where-builder. Type-only Prisma import.
 * Run alone: npx tsx --test src/modules/admin-orders/admin-order-where.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { buildAdminOrderWhere } from './admin-order-where';

test('empty input builds an empty where', () => {
  assert.deepEqual(buildAdminOrderWhere({}), {});
});

test('a single status builds an IN filter', () => {
  assert.deepEqual(buildAdminOrderWhere({ status: [OrderStatus.PROCESSING] }).status, {
    in: ['PROCESSING'],
  });
});

test('multiple statuses build an IN filter', () => {
  assert.deepEqual(buildAdminOrderWhere({ status: [OrderStatus.PENDING, OrderStatus.PAID] }).status, {
    in: ['PENDING', 'PAID'],
  });
});

test('an empty status array adds no status filter', () => {
  assert.equal(buildAdminOrderWhere({ status: [] }).status, undefined);
});

test('paymentStatus filters via a payments relation (some)', () => {
  const where = buildAdminOrderWhere({ paymentStatus: PaymentStatus.SUCCESS });
  assert.deepEqual(where.payments, { some: { status: 'SUCCESS' } });
});

test('paymentMethod filters on the order paymentMethod column', () => {
  assert.equal(buildAdminOrderWhere({ paymentMethod: PaymentMethod.COD }).paymentMethod, 'COD');
});

test('dateFrom/dateTo build a placedAt gte/lte range', () => {
  const where = buildAdminOrderWhere({
    dateFrom: '2026-01-01T00:00:00.000Z',
    dateTo: '2026-02-01T00:00:00.000Z',
  });
  assert.deepEqual(where.placedAt, {
    gte: new Date('2026-01-01T00:00:00.000Z'),
    lte: new Date('2026-02-01T00:00:00.000Z'),
  });
});

test('dateFrom alone builds only gte', () => {
  const where = buildAdminOrderWhere({ dateFrom: '2026-01-01T00:00:00.000Z' });
  assert.deepEqual(where.placedAt, { gte: new Date('2026-01-01T00:00:00.000Z') });
});

test('a date-only dateTo is inclusive through end-of-day', () => {
  const where = buildAdminOrderWhere({ dateTo: '2026-07-04' });
  assert.deepEqual(where.placedAt, { lte: new Date('2026-07-04T23:59:59.999Z') });
});

test('q builds an OR across number, name, phone, and account email; trims', () => {
  const where = buildAdminOrderWhere({ q: '  WH-123 ' });
  assert.deepEqual(where.OR, [
    { number: { contains: 'WH-123', mode: 'insensitive' } },
    { shippingFullName: { contains: 'WH-123', mode: 'insensitive' } },
    { shippingPhone: { contains: 'WH-123', mode: 'insensitive' } },
    { user: { is: { email: { contains: 'WH-123', mode: 'insensitive' } } } },
  ]);
});

test('blank/whitespace q adds no OR', () => {
  assert.equal(buildAdminOrderWhere({ q: '   ' }).OR, undefined);
});
