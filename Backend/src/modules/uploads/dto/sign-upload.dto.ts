import { IsIn } from 'class-validator';

export const UPLOAD_FOLDERS = ['products', 'banners', 'content'] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export class SignUploadDto {
  @IsIn(UPLOAD_FOLDERS)
  folder!: UploadFolder;
}
