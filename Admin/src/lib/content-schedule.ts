/**
 * Bridge between the API's UTC ISO timestamps and an
 * `<input type="datetime-local">`, which speaks local wall-clock at minute
 * precision. Used by the banner + offer-strip schedule fields.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO (or null) → 'YYYY-MM-DDTHH:mm' in local time, or '' when absent/invalid. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local string → UTC ISO, or undefined when empty/invalid. */
export function localToIso(local: string): string | undefined {
  if (!local.trim()) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
