import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum ProductSort {
  Bestsellers = 'bestsellers',
  New = 'new',
  PriceAsc = 'price-asc',
  PriceDesc = 'price-desc',
  Rating = 'rating',
}

const toArray = ({ value }: { value: unknown }): string[] => {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string' && value.length > 0) return value.split(',');
  return [];
};

export class ListProductsDto {
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  category?: string[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  skinType?: string[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  concern?: string[];

  @IsOptional()
  @IsString()
  price?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @IsEnum(ProductSort)
  sort?: ProductSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(96)
  perPage?: number = 24;
}
