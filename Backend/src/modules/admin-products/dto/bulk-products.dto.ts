import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export enum BulkAction {
  Publish = 'publish',
  Draft = 'draft',
  Archive = 'archive',
  Restore = 'restore',
  SetCategory = 'set-category',
}

export class BulkProductsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];

  @IsEnum(BulkAction)
  action!: BulkAction;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
