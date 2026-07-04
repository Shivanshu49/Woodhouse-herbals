/**
 * Cloudinary signed-upload orchestration.
 *
 * The browser POSTs the file DIRECTLY to Cloudinary using a short-lived
 * signature minted server-side by `POST /admin/uploads/sign` — the API secret
 * never reaches the client. We use XMLHttpRequest (not fetch) because it is the
 * only browser primitive that exposes per-file upload *progress*. The XHR is
 * dependency-injected so this module is fully unit-testable without a browser.
 */

/** The signed-upload parameters returned by `POST /admin/uploads/sign`. */
export interface SignResponse {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  uploadUrl: string;
}

/** A single uploaded asset, normalised from the Cloudinary response. */
export interface UploadedImage {
  url: string; // secure_url
  publicId: string; // e.g. "woodhouse/products/abc123"
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
}

interface ProgressEventLike {
  loaded: number;
  total: number;
  lengthComputable: boolean;
}

/** The slice of XMLHttpRequest we depend on — real XHR satisfies it structurally. */
export interface XhrLike {
  open(method: string, url: string): void;
  send(body: FormData): void;
  abort(): void;
  status: number;
  responseText: string;
  upload: { onprogress: ((e: ProgressEventLike) => void) | null } | null;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
}

export interface UploadOptions {
  /** Called with upload progress as a 0..1 fraction. */
  onProgress?: (fraction: number) => void;
  /** Cancel the in-flight upload. */
  signal?: AbortSignal;
  /** Injectable XHR factory (defaults to the browser's XMLHttpRequest). */
  createXhr?: () => XhrLike;
}

/** Build the multipart body Cloudinary expects for a signed upload. */
export function buildUploadFormData(file: Blob, sign: SignResponse): FormData {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sign.apiKey);
  form.append('timestamp', String(sign.timestamp));
  form.append('folder', sign.folder);
  form.append('signature', sign.signature);
  return form;
}

/** Normalise a Cloudinary upload response into our image shape. Throws if unusable. */
export function parseUploadResponse(text: string): UploadedImage {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error('Cloudinary returned an unreadable response.');
  }
  if (!json || typeof json.secure_url !== 'string' || typeof json.public_id !== 'string') {
    throw new Error('Cloudinary response was missing the image URL.');
  }
  const out: UploadedImage = { url: json.secure_url, publicId: json.public_id };
  if (typeof json.width === 'number') out.width = json.width;
  if (typeof json.height === 'number') out.height = json.height;
  if (typeof json.bytes === 'number') out.bytes = json.bytes;
  if (typeof json.format === 'string') out.format = json.format;
  return out;
}

/** Pull a human-readable error out of a Cloudinary failure body. */
export function extractCloudinaryError(text: string, status: number): string {
  try {
    const json = JSON.parse(text) as { error?: { message?: unknown } };
    if (json?.error?.message) return String(json.error.message);
  } catch {
    /* non-JSON body — fall through to the status message */
  }
  return `Upload failed (HTTP ${status}).`;
}

function abortError(): Error {
  const e = new Error('Upload cancelled.');
  e.name = 'AbortError';
  return e;
}

/**
 * Upload one file to Cloudinary with the given signature. Resolves with the
 * normalised asset, rejects on HTTP error / network failure, or rejects with an
 * `AbortError` if the signal fires.
 */
export function uploadToCloudinary(
  file: Blob,
  sign: SignResponse,
  opts: UploadOptions = {},
): Promise<UploadedImage> {
  const createXhr = opts.createXhr ?? (() => new XMLHttpRequest() as unknown as XhrLike);
  return new Promise<UploadedImage>((resolve, reject) => {
    if (opts.signal?.aborted) {
      reject(abortError());
      return;
    }
    const xhr = createXhr();
    xhr.open('POST', sign.uploadUrl);

    if (xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (opts.onProgress && e.lengthComputable && e.total > 0) {
          opts.onProgress(Math.min(1, e.loaded / e.total));
        }
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(parseUploadResponse(xhr.responseText));
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Could not read the upload response.'));
        }
      } else {
        reject(new Error(extractCloudinaryError(xhr.responseText, xhr.status)));
      }
    };
    xhr.onerror = () =>
      reject(new Error('Network error during upload. Check your connection and try again.'));
    xhr.onabort = () => reject(abortError());

    if (opts.signal) {
      opts.signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }
    xhr.send(buildUploadFormData(file, sign));
  });
}
