/** Keys whose VALUES are secrets/live tokens and must never land in the audit log.
 *  `signature` is generic on purpose — it covers `x-razorpay-signature`,
 *  `razorpay_signature`, and any future provider signature header (it also
 *  subsumes the legacy `x-verify` header, which was signature material). */
export const SECRET_KEY = /token|password|secret|inviteurl|reseturl|apikey|credential|signature/i;

/** Deep-redact secret-bearing values so the append-only audit log never persists
 *  a live token (e.g. a staff invite's password-reset URL) or credential.
 *
 *  Dates are converted to ISO strings BEFORE the plain-object walk — a Date is
 *  `typeof 'object'` with no own enumerable keys, so the generic rebuild would
 *  otherwise emit `{}` and silently drop every timestamp in the snapshot. */
export function redactSecrets(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (depth > 6) return value;
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEY.test(k) ? '[redacted]' : redactSecrets(v, depth + 1);
  }
  return out;
}
