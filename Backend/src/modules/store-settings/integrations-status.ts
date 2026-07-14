export interface IntegrationInput {
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
}

export interface IntegrationsStatus {
  cloudinary: boolean;
  r2: boolean;
  razorpay: boolean;
  email: boolean;
}

const has = (...vals: (string | undefined)[]) => vals.every((v) => Boolean(v && v.trim()));

/**
 * Derive configured/not-configured booleans from env presence ONLY — never
 * returns or logs the secret values themselves.
 */
export function integrationsStatus(env: IntegrationInput): IntegrationsStatus {
  return {
    cloudinary: has(env.CLOUDINARY_CLOUD_NAME, env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET),
    r2: has(env.R2_ACCOUNT_ID, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY, env.R2_BUCKET),
    razorpay: has(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET, env.RAZORPAY_WEBHOOK_SECRET),
    email: has(env.RESEND_API_KEY),
  };
}
