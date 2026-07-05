import test from 'node:test';
import assert from 'node:assert/strict';
import { INDIAN_STATES, isKnownState, stateCodeFor } from './indian-states';

test('indian states have unique 2-digit codes', () => {
  const codes = INDIAN_STATES.map((s) => s.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const c of codes) assert.match(c, /^[0-9]{2}$/);
});

test('isKnownState + stateCodeFor are case/space-insensitive', () => {
  assert.equal(isKnownState('Karnataka'), true);
  assert.equal(isKnownState('  karnataka '), true);
  assert.equal(isKnownState('Atlantis'), false);
  assert.equal(stateCodeFor('Karnataka'), '29');
  assert.equal(stateCodeFor('maharashtra'), '27');
  assert.equal(stateCodeFor('Atlantis'), null);
});
