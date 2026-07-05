import test from 'node:test';
import assert from 'node:assert/strict';
import { isoToLocalInput, localToIso } from './content-schedule';

// isoToLocalInput feeds a <input type="datetime-local"> (local wall-clock,
// minute precision); localToIso turns that back into a UTC ISO for the API.

test('isoToLocalInput returns empty for null/empty/invalid', () => {
  assert.equal(isoToLocalInput(null), '');
  assert.equal(isoToLocalInput(''), '');
  assert.equal(isoToLocalInput('not-a-date'), '');
});

test('isoToLocalInput yields a minute-precision datetime-local string', () => {
  const s = isoToLocalInput('2026-02-01T10:30:00.000Z');
  // 'YYYY-MM-DDTHH:mm' — 16 chars, no seconds, no zone marker.
  assert.match(s, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});

test('localToIso returns undefined for empty/invalid (nothing to send)', () => {
  assert.equal(localToIso(''), undefined);
  assert.equal(localToIso('   '), undefined);
  assert.equal(localToIso('not-a-date'), undefined);
});

test('iso → local → iso round-trips to the same instant (timezone-independent)', () => {
  const iso = '2026-02-01T10:30:00.000Z';
  const back = localToIso(isoToLocalInput(iso));
  assert.ok(back);
  assert.equal(new Date(back).getTime(), new Date(iso).getTime());
});
