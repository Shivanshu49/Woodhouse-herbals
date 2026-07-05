import test from 'node:test';
import assert from 'node:assert/strict';
import { amountToWordsINR } from './amount-to-words';

test('amountToWordsINR renders Indian numbering with paise', () => {
  assert.equal(amountToWordsINR(0), 'Rupees Zero Only');
  assert.equal(amountToWordsINR(39800), 'Rupees Three Hundred Ninety Eight Only');
  assert.equal(amountToWordsINR(6071), 'Rupees Sixty and Paise Seventy One Only');
  assert.equal(amountToWordsINR(100), 'Rupees One Only');
  assert.equal(
    amountToWordsINR(150025),
    'Rupees One Thousand Five Hundred and Paise Twenty Five Only',
  );
  // Indian grouping: lakh + crore
  assert.equal(
    amountToWordsINR(1_23_45_678_00),
    'Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only',
  );
});
