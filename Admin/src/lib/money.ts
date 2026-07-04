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
