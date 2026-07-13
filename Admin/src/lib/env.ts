/**
 * Admin env accessor — the single point of NEXT_PUBLIC_* access.
 * Next.js inlines NEXT_PUBLIC_* at build time, so each var is read as a
 * literal `process.env.NEXT_PUBLIC_X` expression. Only public config lives
 * here (URLs); this app holds no server secrets.
 */
interface PublicEnv {
  apiUrl: string;
  siteUrl: string;
}

function readUrl(name: string, raw: string | undefined, fallback: string): string {
  // Treat unset OR empty/whitespace as "not provided" and fall back. Docker sets
  // an unpassed build ARG to "" (not undefined), and `"" ?? fallback` keeps the
  // "", so an empty NEXT_PUBLIC_* would throw at build AND boot without this.
  const value = (raw ?? '').trim() || fallback;
  try {
    // eslint-disable-next-line no-new
    new URL(value);
  } catch {
    throw new Error(`Admin env ${name} is not a valid URL: ${JSON.stringify(value)}`);
  }
  return value;
}

const raw = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
};

export const env: PublicEnv = Object.freeze({
  apiUrl: readUrl('NEXT_PUBLIC_API_URL', raw.apiUrl, 'http://localhost:4000'),
  siteUrl: readUrl('NEXT_PUBLIC_SITE_URL', raw.siteUrl, 'http://localhost:3001'),
});

export type { PublicEnv };
