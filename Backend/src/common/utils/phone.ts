/**
 * Normalise an Indian mobile number to canonical `+91XXXXXXXXXX` form.
 * Accepts `9812345678`, `09812345678`, `919812345678`, `+91 98123 45678`,
 * with spaces/dashes/parentheses. Returns null when the input is not a
 * plausible Indian mobile (must start 6-9, exactly 10 significant digits).
 */
export function normalizeIndianPhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/[\s\-().]/g, '');
  const m = digits.match(/^(?:\+?91|0)?([6-9]\d{9})$/);
  return m ? `+91${m[1]}` : null;
}
