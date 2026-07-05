/**
 * Format an INR amount stored in paise (minor units) for display, e.g.
 * 19900 => "₹199", 24450 => "₹244.50". Uses the Indian digit grouping.
 */
export function formatInr(minor: number): string {
  const rupees = minor / 100;
  const hasPaise = minor % 100 !== 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: hasPaise ? 2 : 0,
  }).format(rupees);
}

/**
 * Parse a rupee text amount to integer paise. Tolerates thousands commas and
 * surrounding whitespace. Rejects (returns null) anything that isn't a
 * non-negative amount with at most 2 decimal places — sub-paise precision is
 * refused rather than silently truncated.
 */
export function rupeesToPaise(input: string): number | null {
  const cleaned = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}

/** Paise -> a minimal, typable rupee string (trailing zeros stripped): 19950 -> "199.5". */
export function paiseToRupees(paise: number): string {
  return (paise / 100)
    .toFixed(2)
    .replace(/\.0+$/, '')
    .replace(/(\.\d)0$/, '$1');
}
