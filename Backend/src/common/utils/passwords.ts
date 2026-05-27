import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

/**
 * Common passwords blocklist — replaceable with a HaveIBeenPwned k-anonymity
 * lookup in production. Keeping it intentionally short here so the dev
 * experience isn't bottlenecked on a network call; the full list lives in the
 * Resend/marketing side via the password-strength API.
 */
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  'qwerty',
  'qwerty123',
  '12345678',
  '123456789',
  '1234567890',
  'iloveyou',
  'admin',
  'welcome',
  'letmein',
  'monkey',
  'football',
  'baseball',
]);

export interface PasswordPolicy {
  minLength: number;
  requireLower: boolean;
  requireUpper: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 10,
  requireLower: true,
  requireUpper: true,
  requireDigit: true,
  requireSymbol: false,
};

export function validatePasswordStrength(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): string[] {
  const errors: string[] = [];
  if (password.length < policy.minLength) errors.push(`Password must be at least ${policy.minLength} characters.`);
  if (policy.requireLower && !/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter.');
  if (policy.requireUpper && !/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter.');
  if (policy.requireDigit && !/\d/.test(password)) errors.push('Password must contain a number.');
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) errors.push('Password must contain a symbol.');
  if (COMMON_PASSWORDS.has(password.toLowerCase())) errors.push('Password is too common; choose something less guessable.');
  return errors;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Returns a hash for use in equal-cost comparisons against an attacker
 * probing for the existence of an email — we still run a bcrypt compare even
 * if the user doesn't exist, to avoid leaking timing information.
 */
export const DUMMY_PASSWORD_HASH =
  '$2a$12$CwTycUXWue0Thq9StjUM0uJ8Y4Vv9oWQ.JfYf1lLuPe5z2Q4Cz4Ke';
