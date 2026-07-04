import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { env } from '../../common/config/env';
import { signCloudinaryParams } from './cloudinary-signature';

@Injectable()
export class UploadsService {
  /**
   * Returns everything the browser needs to POST a file DIRECTLY to
   * Cloudinary (multipart fields: file, api_key, timestamp, folder,
   * signature). The API secret stays server-side.
   */
  sign(input: { folder: string }) {
    const cloudName = env.CLOUDINARY_CLOUD_NAME;
    const apiKey = env.CLOUDINARY_API_KEY;
    const apiSecret = env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException('Image uploads are not configured.');
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `woodhouse/${input.folder}`;
    const signature = signCloudinaryParams({ folder, timestamp }, apiSecret);
    return {
      cloudName,
      apiKey,
      timestamp,
      folder,
      signature,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    };
  }

  /**
   * Destroy a Cloudinary asset by public_id. Used by the admin product form to
   * clean up an image the moment it is removed before the product is saved, so
   * it is never orphaned. The controller/DTO restricts public_id to our own
   * `woodhouse/...` folders; this is the server-signed call that actually
   * deletes it (a signed destroy — the API secret never leaves the server).
   */
  async destroy(publicId: string): Promise<{ result: string }> {
    const cloudName = env.CLOUDINARY_CLOUD_NAME;
    const apiKey = env.CLOUDINARY_API_KEY;
    const apiSecret = env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException('Image uploads are not configured.');
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signCloudinaryParams({ public_id: publicId, timestamp }, apiSecret);
    const body = new URLSearchParams({
      public_id: publicId,
      timestamp: String(timestamp),
      api_key: apiKey,
      signature,
    });

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
      method: 'POST',
      body,
    });
    if (!res.ok) {
      throw new ServiceUnavailableException('Failed to delete the image.');
    }
    // Cloudinary returns { result: 'ok' } on success, { result: 'not found' }
    // when the asset is already gone — both are fine for our cleanup intent.
    const json = (await res.json()) as { result?: string };
    return { result: json.result ?? 'unknown' };
  }
}
