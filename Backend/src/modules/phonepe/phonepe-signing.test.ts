/**
 * Pure unit tests for PhonePe X-VERIFY signing (legacy Hermes scheme). No IO.
 * Run alone: npx tsx --test src/modules/phonepe/phonepe-signing.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  requestChecksum,
  statusChecksum,
  callbackChecksum,
  buildRefundPayload,
} from './phonepe-signing';

const salt = 'test-salt';
const idx = '1';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

test('requestChecksum = sha256(base64 + path + salt)###idx', () => {
  assert.equal(
    requestChecksum('YmFzZTY0', '/pg/v1/refund', salt, idx),
    `${sha('YmFzZTY0/pg/v1/refund' + salt)}###1`,
  );
});

test('statusChecksum = sha256(path + salt)###idx (no base64 body)', () => {
  const path = '/pg/v1/status/M1/RFabc';
  assert.equal(statusChecksum(path, salt, idx), `${sha(path + salt)}###1`);
});

test('callbackChecksum = sha256(base64Response + salt)###idx (no path)', () => {
  assert.equal(callbackChecksum('cmVzcA==', salt, idx), `${sha('cmVzcA==' + salt)}###1`);
});

test('buildRefundPayload base64-encodes the correct fields + signs for /pg/v1/refund', () => {
  const { base64, checksum } = buildRefundPayload(
    {
      merchantId: 'M1',
      merchantUserId: 'U1',
      originalTxnId: 'WH123',
      merchantRefundId: 'RFabc',
      amountMinor: 10000,
      callbackUrl: 'https://x/api/phonepe/callback',
    },
    salt,
    idx,
  );
  const decoded = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
  assert.equal(decoded.merchantId, 'M1');
  assert.equal(decoded.originalTransactionId, 'WH123'); // original payment id
  assert.equal(decoded.merchantTransactionId, 'RFabc'); // the refund's own id
  assert.equal(decoded.amount, 10000);
  assert.equal(checksum, `${sha(base64 + '/pg/v1/refund' + salt)}###1`);
});
