import { Matches } from 'class-validator';

/**
 * Only assets under our own upload folders may be destroyed from the admin —
 * the regex is the safety boundary that stops an admin (or a bug) from
 * deleting an arbitrary Cloudinary public_id.
 */
export class DeleteUploadDto {
  @Matches(/^woodhouse\/(products|banners|content)\/[A-Za-z0-9._/-]+$/, {
    message: 'publicId must be an asset under woodhouse/{products|banners|content}/',
  })
  publicId!: string;
}
