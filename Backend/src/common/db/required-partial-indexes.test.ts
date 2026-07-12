/**
 * Tests for the DB-invariant gate that makes the money-critical partial
 * unique indexes undroppable (Razorpay migration §2c item 1).
 *
 * The pure validator is tested here; the process.exit(1) wiring is proven by
 * the doctored-DB demo in the Phase-0 checkpoint (drop index → prod boot
 * exits 1) and re-proven by CI on every push.
 *
 * Run: npx tsx --test src/common/db/required-partial-indexes.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REQUIRED_PARTIAL_INDEXES,
  checkRequiredPartialIndexes,
  type PgIndexRow,
} from './required-partial-indexes';

const GOOD_ROW: PgIndexRow = {
  indexname: 'refund_one_active_per_order',
  indexdef:
    'CREATE UNIQUE INDEX refund_one_active_per_order ON public."Refund" USING btree ("orderId") WHERE (status <> \'FAILED\'::"RefundStatus")',
};

test('the required list contains the refund double-payout guard', () => {
  const names = REQUIRED_PARTIAL_INDEXES.map((i) => i.name);
  assert.ok(names.includes('refund_one_active_per_order'));
  // Every entry must name the migration that owns it, so the boot error can
  // point straight at the fix.
  for (const idx of REQUIRED_PARTIAL_INDEXES) {
    assert.match(idx.migrationFile, /^\d{14}_/);
  }
});

test('a present, UNIQUE, partial index passes', () => {
  const errors = checkRequiredPartialIndexes(
    [{ name: 'refund_one_active_per_order', migrationFile: '20260705014511_refunds_d1b' }],
    [GOOD_ROW],
  );
  assert.deepEqual(errors, []);
});

test('a missing index is reported with its owning migration file', () => {
  const errors = checkRequiredPartialIndexes(
    [{ name: 'refund_one_active_per_order', migrationFile: '20260705014511_refunds_d1b' }],
    [],
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0]!, /refund_one_active_per_order/);
  assert.match(errors[0]!, /20260705014511_refunds_d1b/);
});

test('an index that lost its UNIQUE qualifier is rejected', () => {
  const errors = checkRequiredPartialIndexes(
    [{ name: 'refund_one_active_per_order', migrationFile: '20260705014511_refunds_d1b' }],
    [{ ...GOOD_ROW, indexdef: GOOD_ROW.indexdef.replace('UNIQUE ', '') }],
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0]!, /UNIQUE/);
});

test('an index that lost its WHERE predicate is rejected', () => {
  const noWhere = GOOD_ROW.indexdef.slice(0, GOOD_ROW.indexdef.indexOf(' WHERE '));
  const errors = checkRequiredPartialIndexes(
    [{ name: 'refund_one_active_per_order', migrationFile: '20260705014511_refunds_d1b' }],
    [{ ...GOOD_ROW, indexdef: noWhere }],
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0]!, /WHERE/);
});

test('multiple problems are all reported (not first-error-only)', () => {
  const errors = checkRequiredPartialIndexes(
    [
      { name: 'refund_one_active_per_order', migrationFile: '20260705014511_refunds_d1b' },
      { name: 'payment_one_initiated_per_order', migrationFile: 'future_phase_1' },
    ],
    [{ ...GOOD_ROW, indexdef: GOOD_ROW.indexdef.replace('UNIQUE ', '') }],
  );
  assert.equal(errors.length, 2);
});
