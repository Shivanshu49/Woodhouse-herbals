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
 *   - Razorpay credentials (key id/secret + webhook secret) are missing —
 *     without the webhook secret the HMAC webhook verification is defeated
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
  // Shared parent domain for auth cookies across the storefront + admin
  // subdomains, e.g. ".woodhouseherbals.com". Leave UNSET in dev (localhost
  // cannot use a Domain attribute); when unset, cookies are host-only.
  COOKIE_DOMAIN: z.string().optional(),

  DATABASE_URL: z.string().url().startsWith('postgres'),
  REDIS_URL: z.string().url().optional(),

  JWT_ACCESS_SECRET: strongSecret('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: strongSecret('JWT_REFRESH_SECRET'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),       // 15 min
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2592000),  // 30 days

  // Staff/admin refresh TTL — short so an IDLE admin session hard-expires
  // server-side; each rotation re-ups it, so ACTIVE sessions slide forward.
  JWT_ADMIN_REFRESH_TTL: z.coerce.number().int().positive().default(3600), // 60 min

  // Email verification + password reset
  EMAIL_VERIFICATION_TTL: z.coerce.number().int().positive().default(60 * 60 * 24), // 24 h
  PASSWORD_RESET_TTL: z.coerce.number().int().positive().default(60 * 60),          // 1 h

  // Login throttle / lockout policy
  AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(30),

  // GST rate applied at checkout. Catalog prices are GST-inclusive, so this
  // only governs the tax component split out for the invoice — it never
  // changes the customer-facing total. 0 disables the split.
  GST_RATE_PERCENT: z.coerce.number().min(0).max(28).default(18),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('no-reply@woodhouseherbals.com'),

  // Phone-OTP SMS delivery via MSG91. Optional in dev (the OTP is logged and
  // echoed back to the client instead); without them in prod the OTP
  // endpoints return 503 rather than silently swallowing codes.
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),

  // OAuth client id for "Sign in with Google" (ID-token verification
  // audience). The same value is exposed to the frontend as
  // NEXT_PUBLIC_GOOGLE_CLIENT_ID. Optional — endpoint 503s when unset.
  GOOGLE_CLIENT_ID: z.string().optional(),

  // Admin app origin — staff/admin password-reset links point here.
  ADMIN_ORIGIN: z.string().url().optional(),

  // Cloudinary signed uploads (admin media). Optional — the sign endpoint
  // returns 503 until all three are configured.
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Phone OTP policy
  OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(10).default(5),
  OTP_REQUESTS_PER_WINDOW: z.coerce.number().int().min(1).max(10).default(3),

  // Razorpay — NO dev fallbacks by design (test-mode keys are real
  // credentials; there is no safe committed equivalent). Unset ⇒ the payment
  // + refund endpoints return 503 (the MSG91/Cloudinary pattern); the three
  // core keys are hard-required at prod boot (refine block below).
  // WEBHOOK_SECRET_OLD exists only for the ≤24h rotation window (retried
  // deliveries stay signed with the old secret) — clear it after.
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET_OLD: z.string().optional(),

  // Express 'trust proxy' hop count. Default 1 = exactly one trusted proxy.
  // ⚠ The deploy target is a Hostinger KVM VPS running Coolify (Traefik
  // ingress) — NOT Railway, which the original analysis assumed. On that
  // topology there is always ≥1 hop (Traefik), and with Cloudflare in front
  // the chain is CF → Traefik → app (expected 2). The correct value MUST be
  // verified empirically at cutover (log req.ip + the X-Forwarded-For chain
  // on a test request); do not assume it from any prior analysis. Traefik
  // must also be configured to trust forwarded headers only from Cloudflare
  // ranges, or a client-forged XFF survives.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(4).default(1),

  // Reconciliation cron knobs (consumed in Phase 6; declared with the rest
  // of the payment config so the §5 env table stays the single source).
  RECONCILE_PAYMENT_MIN_AGE_MIN: z.coerce.number().int().positive().default(15),
  REFUND_CONCLUDE_MIN_AGE_MIN: z.coerce.number().int().positive().default(15),
  PAYMENT_ABANDON_TTL_HOURS: z.coerce.number().int().positive().default(24),

  MEILI_HOST: z.string().url().optional(),
  MEILI_API_KEY: z.string().optional(),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),

  // Interactive-transaction window (ms) for admin product create/update/bulk
  // writes. Neon's pooled connection can add meaningful per-query latency
  // across the several nested-collection round trips in one product write,
  // so the default 5s window is too tight — see admin-products.service.ts.
  ADMIN_WRITE_TX_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
});

export type AppEnv = z.infer<typeof schema>;

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
    if (!parsed.data.RAZORPAY_KEY_ID) errors.push('RAZORPAY_KEY_ID is required');
    if (!parsed.data.RAZORPAY_KEY_SECRET) errors.push('RAZORPAY_KEY_SECRET is required');
    if (!parsed.data.RAZORPAY_WEBHOOK_SECRET) errors.push('RAZORPAY_WEBHOOK_SECRET is required');
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
