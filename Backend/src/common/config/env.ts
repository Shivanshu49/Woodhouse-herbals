import { z } from 'zod';

/**
 * Boot-time environment validation.
 *
 * Refuses to start the server with weak / missing secrets in production.
 * Dev allows safe defaults, but the application logs a warning and a single
 * place is responsible for materialising config (no `process.env.X ?? '...'`
 * scattered across the codebase).
 */

const isProd = process.env.NODE_ENV === 'production';

// In production HS256 secrets should be ≥256-bit (64 hex chars). Anything
// shorter dramatically reduces brute-force cost.
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
  if (isProd && parsed.data.JWT_ACCESS_SECRET === parsed.data.JWT_REFRESH_SECRET) {
    // eslint-disable-next-line no-console
    console.error('❌ JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be distinct in production.');
    process.exit(1);
  }
  if (isProd && parsed.data.RESEND_API_KEY === undefined) {
    // eslint-disable-next-line no-console
    console.warn('⚠ RESEND_API_KEY not set — verification & reset emails will be skipped.');
  }
  cached = parsed.data;
  return cached;
}

export const env = new Proxy({} as AppEnv, {
  get(_t, prop: string) {
    return (loadEnv() as Record<string, unknown>)[prop];
  },
});
