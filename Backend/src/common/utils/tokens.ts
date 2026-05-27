import { createHash, randomBytes } from 'node:crypto';

/**
 * Cryptographic token utilities.
 *
 * Tokens are generated with crypto.randomBytes (CSPRNG), urlsafe-base64
 * encoded, and stored hashed (SHA-256). The raw token only ever leaves the
 * server in the email/link to the user; the database holds only the hash so
 * a DB leak does not yield usable verification or reset tokens.
 */

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  // SHA-256 is fine here — tokens are 256-bit random, not low-entropy passwords.
  return createHash('sha256').update(token).digest('hex');
}

export function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
