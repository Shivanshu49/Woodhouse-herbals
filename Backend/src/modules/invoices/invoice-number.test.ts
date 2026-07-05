import test from 'node:test';
import assert from 'node:assert/strict';
import { financialYearOf, formatInvoiceNumber } from './invoice-number';

test('financialYearOf uses the Indian FY (Apr 1–Mar 31), computed in IST', () => {
  assert.equal(financialYearOf(new Date('2026-07-05T00:00:00Z')), '2026-27');
  assert.equal(financialYearOf(new Date('2026-04-01T00:00:00Z')), '2026-27'); // Apr 1 05:30 IST
  // Mar 31 15:30 IST (10:00Z) is still FY2025-26...
  assert.equal(financialYearOf(new Date('2026-03-31T10:00:00Z')), '2025-26');
  // ...but Mar 31 20:00Z is Apr 1 01:30 IST → FY2026-27 (the drift the SHIPPED trigger fixes)
  assert.equal(financialYearOf(new Date('2026-03-31T20:00:00Z')), '2026-27');
  assert.equal(financialYearOf(new Date('2027-01-15T00:00:00Z')), '2026-27');
});

test('formatInvoiceNumber zero-pads the sequence to 5 digits', () => {
  assert.equal(formatInvoiceNumber('2026-27', 1), 'INV-2026-27-00001');
  assert.equal(formatInvoiceNumber('2026-27', 4210), 'INV-2026-27-04210');
});
