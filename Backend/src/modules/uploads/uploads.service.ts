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
}
