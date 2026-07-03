import { createHash } from 'node:crypto';

/**
 * Cloudinary signed-upload signature: SHA-1 hex over the alphabetically
 * sorted `key=value` pairs joined with '&', with the API secret appended.
 * https://cloudinary.com/documentation/upload_images#generating_authentication_signatures
 * Empty/undefined params are excluded (Cloudinary ignores them too).
 */
export function signCloudinaryParams(
  params: Record<string, string | number | boolean | undefined>,
  apiSecret: string,
): string {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1').update(toSign + apiSecret).digest('hex');
}
