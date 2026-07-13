/**
 * Frontend env accessor — the single point of `process.env.NEXT_PUBLIC_*` access.
 *
 * Every component must import from here rather than reach into `process.env`
 * directly. Next.js inlines `NEXT_PUBLIC_*` at build time, so:
 *
 *   1. Variables that don't start with `NEXT_PUBLIC_` are NEVER exposed to
 *      the browser bundle — only the server-rendering pass on the Node
 *      side can see them. Putting a server-only secret here would be a
 *      security bug.
 *   2. Anything in this file is shipped to every visitor's browser. Keep
 *      it to URLs and feature flags. Never API keys, never DB strings.
 *
 * The values are validated once at module load and frozen.
 */

interface PublicEnv {
  apiUrl: string;
  aiUrl: string;
  siteUrl: string;
  /** Google OAuth client id for "Sign in with Google" — null hides the button. */
  googleClientId: string | null;
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
    throw new Error(`Frontend env ${name} is not a valid URL: ${JSON.stringify(value)}`);
  }
  return value;
}

// Read each variable explicitly — Next.js's static inlining means we can
// NOT iterate over `process.env` keys to discover them. The expression
// must be the literal `process.env.NEXT_PUBLIC_X` at the call site so the
// build-time replacement step picks it up.
const raw = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  aiUrl: process.env.NEXT_PUBLIC_AI_URL,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
};

export const env: PublicEnv = Object.freeze({
  apiUrl: readUrl('NEXT_PUBLIC_API_URL', raw.apiUrl, 'http://localhost:4000'),
  aiUrl: readUrl('NEXT_PUBLIC_AI_URL', raw.aiUrl, 'http://localhost:8001'),
  siteUrl: readUrl('NEXT_PUBLIC_SITE_URL', raw.siteUrl, 'http://localhost:3000'),
  googleClientId: raw.googleClientId?.trim() || null,
});

export type { PublicEnv };
