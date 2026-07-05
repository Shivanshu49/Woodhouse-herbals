import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInvoiceProfile } from './store-profile';

const full = {
  'store.name': 'Wood House Herbals',
  'store.gstin': '29ABCDE1234F1Z5',
  'store.address': '12 Herbal Rd, Bengaluru 560001',
  'store.pan': 'ABCDE1234F',
  'store.state': 'Karnataka',
  'store.stateCode': '29',
  'store.shippingGstRate': 18,
};

test('buildInvoiceProfile assembles a typed profile', () => {
  const p = buildInvoiceProfile(full);
  assert.equal(p.legalName, 'Wood House Herbals');
  assert.equal(p.gstin, '29ABCDE1234F1Z5');
  assert.equal(p.state, 'Karnataka');
  assert.equal(p.shippingGstRatePercent, 18);
});

test('buildInvoiceProfile prefers store.legalName over store.name when present', () => {
  const p = buildInvoiceProfile({ ...full, 'store.legalName': 'Wood House Herbals Pvt Ltd' });
  assert.equal(p.legalName, 'Wood House Herbals Pvt Ltd');
});

test('buildInvoiceProfile throws when a required key is unset', () => {
  assert.throws(() => buildInvoiceProfile({ ...full, 'store.gstin': null }), /gstin/i);
  assert.throws(() => buildInvoiceProfile({ ...full, 'store.state': null }), /state/i);
  assert.throws(() => buildInvoiceProfile({ ...full, 'store.address': '   ' }), /address/i);
});

test('buildInvoiceProfile defaults shipping GST to 18 when unset', () => {
  const { 'store.shippingGstRate': _omit, ...rest } = full;
  assert.equal(buildInvoiceProfile(rest).shippingGstRatePercent, 18);
});
