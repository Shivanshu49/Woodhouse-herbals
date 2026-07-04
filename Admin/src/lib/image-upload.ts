/** Client-side image constraints for admin uploads. Enforced BEFORE any
 *  Cloudinary request so oversized / wrong-type files never leave the browser. */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** For the file input's `accept` attribute. */
export const ACCEPTED_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

/** A structural subset of File so this stays unit-testable without the DOM. */
export interface ValidatableFile {
  type: string;
  size: number;
}

/** Returns an error message if the file is invalid, or null if it's acceptable. */
export function validateImageFile(file: ValidatableFile): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return 'Unsupported format — use JPG, PNG or WebP.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `Image is ${mb} MB — must be under 5 MB.`;
  }
  return null;
}
