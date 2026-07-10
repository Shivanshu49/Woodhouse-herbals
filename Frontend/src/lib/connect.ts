/**
 * Shared "Connect With Us" attachment rules — imported by both the client form
 * (ConnectUs) and the /api/connect route so the two validations cannot drift.
 *
 * 4MB, not the 5MB the copy originally asked for: Vercel rejects request
 * bodies over 4.5MB before the function runs, so a 5MB promise is one the
 * deploy target can't keep. 4MB leaves room for the multipart envelope.
 */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
export const MAX_ATTACHMENT_LABEL = '4MB';

export const ATTACHMENT_MIME = /^(image\/(jpeg|png|webp|gif|heic|heif)|application\/pdf)$/;
// Fallback for browsers that report an empty File.type (Chrome/Firefox on
// Windows/Linux/Android commonly have no OS MIME mapping for HEIC/HEIF).
export const ATTACHMENT_EXT = /\.(jpe?g|png|webp|gif|heic|heif|pdf)$/i;

// The picker filter mirrors exactly what the validator accepts — a broader
// `image/*` would offer .bmp/.tiff files only to reject them after selection,
// and would hide .heic on platforms whose MIME registry doesn't map it.
export const ATTACHMENT_ACCEPT =
  '.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf';

// Error copy shared verbatim by the client form and the route, so the same
// failure never reads differently depending on which side caught it.
export const ATTACHMENT_SIZE_ERROR = `Attachment must be ${MAX_ATTACHMENT_LABEL} or smaller.`;
export const ATTACHMENT_TYPE_ERROR = 'Attach an image or a PDF.';

export function attachmentLooksAllowed(file: { type: string; name: string }): boolean {
  if (file.type) return ATTACHMENT_MIME.test(file.type);
  return ATTACHMENT_EXT.test(file.name);
}
