/** Compact relative time ("just now", "30m ago", "3d ago") from an ISO string. */
export function relativeTime(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime();
  const sec = Math.round((nowMs - then) / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  if (day < 30) return `${Math.round(day / 7)}w ago`;
  if (day < 365) return `${Math.round(day / 30)}mo ago`;
  return `${Math.round(day / 365)}y ago`;
}

/** Full, unambiguous timestamp for the hover tooltip. */
export function absoluteTime(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}
