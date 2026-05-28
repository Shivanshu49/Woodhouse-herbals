import { z } from 'zod';

/**
 * Boot-time environment validation — the SINGLE point of env access.
 *
 * Every other file in this codebase must read configuration through the
 * exported `env` proxy below; raw `process.env.X` reads are linted out
 * by code review (see common/config/env.ts:0 in the audit doc). Two
 * deliberate exceptions:
 *
 *   1. This file itself (it has to read `process.env` to validate it).
 *   2. `process.env.npm_package_version` — npm-injected at runtime, not
 *      app config. We surface it as `APP_VERSION` below so even that
 *      stays funnelled through this module.
 *
 * Validation refuses to boot in production when:
 *   - a JWT secret is short, missing, or a known placeholder
 *   - access ≡ refresh secret
 *   - PhonePe credentials are missing (silent dev-salt fallback would
 *     trivially defeat HMAC webhook verification in prod)
 *   - DATABASE_URL is missing
 *
 * Dev relaxes these so the app boots from a half-filled .env.example.
 */

const isProd = process.env.NODE_ENV === 'production';

// HS256 secrets should be ≥256-bit (64 hex chars) in production. Lower
// in dev so we can boot from a half-filled .env.example.
const minSecret = isProd ? 64 : 8;
const forbiddenSecretValues = new Set(
  [
    'dev-secret',
    'dev-refresh',
    'change-me',
    'replace_me_in_production',
    'secret',
    'changeme',
    // Strings shipped by older versions of .env.example — explicitly banned
    // so a copy/paste from the template can never reach production.
    'dev-only-please-change-to-64-hex-chars-in-production',
    'replace_me',
    'replaceme',
  ].map((v) => v.toLowerCase()),
);

const strongSecret = (label: string) =>
  z
    .string()
    .min(minSecret, `${label} must be at least ${minSecret} characters`)
    .refine(
      (v) => !forbiddenSecretValues.has(v.toLowerCase()),
      `${label} must not use a default placeholder value`,
    );

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().min(1).default('http://localhost:3000'),

  DATABASE_URL: z.string().url().startsWith('postgres'),
  REDIS_URL: z.string().url().optional(),

  JWT_ACCESS_SECRET: strongSecret('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: strongSecret('JWT_REFRESH_SECRET'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),       // 15 min
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2592000),  // 30 days

  // Email verification + password reset
  EMAIL_VERIFICATION_TTL: z.coerce.number().int().positive().default(60 * 60 * 24), // 24 h
  PASSWORD_RESET_TTL: z.coerce.number().int().positive().default(60 * 60),          // 1 h

  // Login throttle / lockout policy
  AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(30),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('no-reply@woodhouseherbals.com'),

  // PhonePe — optional in dev so the app boots without payment credentials,
  // hard-required in prod (enforced in the refine block below). The dev
  // fallback values live in DEV_FALLBACKS so they are visible in one place.
  PHONEPE_MERCHANT_ID: z.string().optional(),
  PHONEPE_SALT_KEY: z.string().optional(),
  PHONEPE_SALT_INDEX: z.string().default('1'),
  PHONEPE_BASE_URL: z.string().url().optional(),

  MEILI_HOST: z.string().url().optional(),
  MEILI_API_KEY: z.string().optional(),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
});

export type AppEnv = z.infer<typeof schema>;

/**
 * Dev-only fallbacks for optional credentials. Visible in ONE place so a
 * reader auditing for "what does this look like with no .env" gets a clear
 * answer. Production paths never read these — see assertion in `loadEnv`.
 */
export const DEV_FALLBACKS = {
  PHONEPE_MERCHANT_ID: 'PGTESTPAYUAT',
  PHONEPE_SALT_KEY: 'dev-salt',
  PHONEPE_SALT_INDEX: '1',
} as const;

/** App version — sourced from npm at runtime, with a literal fallback. */
export const APP_VERSION = process.env.npm_package_version ?? '0.1.0';

let cached: AppEnv | undefined;

export function loadEnv(): AppEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('❌ Invalid environment configuration:');
    for (const issue of parsed.error.issues) {
      // eslint-disable-next-line no-console
      console.error(`  • ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  // Production-only cross-field invariants. Kept here (not inside the Zod
  // schema) because they depend on NODE_ENV being the *parsed* value, not
  // the raw env var — and because emitting clear errors per check is more
  // useful than a single noisy refinement.
  if (parsed.data.NODE_ENV === 'production') {
    const errors: string[] = [];
    if (parsed.data.JWT_ACCESS_SECRET === parsed.data.JWT_REFRESH_SECRET) {
      errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be distinct');
    }
    if (!parsed.data.PHONEPE_MERCHANT_ID) errors.push('PHONEPE_MERCHANT_ID is required');
    if (!parsed.data.PHONEPE_SALT_KEY) errors.push('PHONEPE_SALT_KEY is required');
    if (!parsed.data.PHONEPE_BASE_URL) errors.push('PHONEPE_BASE_URL is required');
    if (errors.length) {
      // eslint-disable-next-line no-console
      console.error('❌ Production env errors:');
      for (const e of errors) {
        // eslint-disable-next-line no-console
        console.error(`  • ${e}`);
      }
      process.exit(1);
    }
    if (parsed.data.RESEND_API_KEY === undefined) {
      // eslint-disable-next-line no-console
      console.warn('⚠ RESEND_API_KEY not set — verification & reset emails will be skipped.');
    }
  }

  cached = parsed.data;
  return cached;
}

/**
 * Lazy accessor. Every read funnels through `loadEnv`, which is memoized
 * so the Zod parse cost is paid exactly once per process.
 *
 *   import { env } from '../common/config/env';
 *   if (env.NODE_ENV === 'production') { ... }
 */
export const env = new Proxy({} as AppEnv, {
  get(_t, prop: string) {
    return (loadEnv() as Record<string, unknown>)[prop];
  },
});

/**
 * Tests only. Clears the memoized parse so a subsequent `env.X` read
 * re-evaluates against the (test-mutated) `process.env`. Tests should
 * call this in `beforeEach` whenever they mutate env vars between tests.
 */
export function resetEnvCacheForTests(): void {
  cached = undefined;
}
