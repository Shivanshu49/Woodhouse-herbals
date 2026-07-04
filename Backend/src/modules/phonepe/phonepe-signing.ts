import { createHash } from 'node:crypto';

const sha256Hex = (s: string) => createHash('sha256').update(s).digest('hex');

/** X-VERIFY for a POST request: base64 body + endpoint path + salt. */
export function requestChecksum(
  base64: string,
  path: string,
  saltKey: string,
  saltIndex: string,
): string {
  return `${sha256Hex(base64 + path + saltKey)}###${saltIndex}`;
}

/** X-VERIFY for a GET Check-Status: the literal path + salt (no body). */
export function statusChecksum(path: string, saltKey: string, saltIndex: string): string {
  return `${sha256Hex(path + saltKey)}###${saltIndex}`;
}

/** X-VERIFY for an inbound webhook: base64 response + salt (no path). */
export function callbackChecksum(
  base64Response: string,
  saltKey: string,
  saltIndex: string,
): string {
  return `${sha256Hex(base64Response + saltKey)}###${saltIndex}`;
}

export interface RefundPayloadInput {
  merchantId: string;
  merchantUserId: string;
  originalTxnId: string; // the ORIGINAL payment's merchantTransactionId
  merchantRefundId: string; // the refund's own new id
  amountMinor: number;
  callbackUrl: string;
}

/** Build the base64 refund request body + its X-VERIFY checksum. */
export function buildRefundPayload(
  input: RefundPayloadInput,
  saltKey: string,
  saltIndex: string,
): { base64: string; checksum: string } {
  const body = {
    merchantId: input.merchantId,
    merchantUserId: input.merchantUserId,
    originalTransactionId: input.originalTxnId,
    merchantTransactionId: input.merchantRefundId,
    amount: input.amountMinor,
    callbackUrl: input.callbackUrl,
  };
  const base64 = Buffer.from(JSON.stringify(body)).toString('base64');
  return { base64, checksum: requestChecksum(base64, '/pg/v1/refund', saltKey, saltIndex) };
}
