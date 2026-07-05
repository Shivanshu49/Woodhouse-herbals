import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidGstin, validateStoreProfilePatch } from './store-profile-validation';

test('isValidGstin accepts a well-formed GSTIN and rejects malformed ones', () => {
  assert.equal(isValidGstin('29ABCDE1234F1Z5'), true);
  assert.equal(isValidGstin('27AAACW1234F1Z8'), true);
  assert.equal(isValidGstin('29abcde1234f1z5'), true); // normalized to upper before test
  assert.equal(isValidGstin('29ABCDE1234F1Z'), false); // 14 chars
  assert.equal(isValidGstin('ABCDE1234F1Z5XX'), false); // wrong shape
  assert.equal(isValidGstin(''), false);
});

test('validateStoreProfilePatch derives stateCode from the state and rejects unknowns', () => {
  const ok = validateStoreProfilePatch({ state: 'Karnataka' });
  assert.equal(ok.ok, true);
  assert.equal(ok.normalized.state, 'Karnataka');
  assert.equal(ok.normalized.stateCode, '29'); // authoritative, derived — not client-sent

  const bad = validateStoreProfilePatch({ state: 'Atlantis' });
  assert.equal(bad.ok, false);
  assert.match(bad.errors.state, /recognised Indian state/i);
});

test('validateStoreProfilePatch flags a bad GSTIN, PAN, and shipping rate; normalizes GSTIN to upper', () => {
  const r = validateStoreProfilePatch({ gstin: '29abcde1234f1z5', pan: 'ABCDE1234F', shippingGstRate: 18 });
  assert.equal(r.ok, true);
  assert.equal(r.normalized.gstin, '29ABCDE1234F1Z5');

  const bad = validateStoreProfilePatch({ gstin: 'nope', pan: 'bad', shippingGstRate: 7 });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.gstin && bad.errors.pan && bad.errors.shippingGstRate);
});

test('validateStoreProfilePatch rejects empty required strings', () => {
  const r = validateStoreProfilePatch({ legalName: '  ', address: '' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.legalName && r.errors.address);
});
