import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ProductCategory, ProductStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { parseBool } from '../parse-bool';

export enum AdminProductSort {
  Newest = 'newest',
  Oldest = 'oldest',
  PriceAsc = 'price-asc',
  PriceDesc = 'price-desc',
  StockAsc = 'stock-asc',
  StockDesc = 'stock-desc',
  Name = 'name',
}

export class ListAdminProductsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @IsOptional()
  @IsIn(['in', 'out', 'low'])
  stock?: 'in' | 'out' | 'low';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMax?: number;

  @IsOptional()
  @IsEnum(AdminProductSort)
  sort?: AdminProductSort = AdminProductSort.Newest;

  // Reads from `obj[key]` (the raw query value) rather than the destructured
  // `value` — with the global ValidationPipe's `enableImplicitConversion`,
  // class-transformer's own implicit Boolean(x) coercion runs on `value`
  // BEFORE this decorator (it's applied to the reflected `boolean` design
  // type ahead of custom @Transform callbacks), which would otherwise hand
  // us an already-mangled `true` for the string "false". Reading the raw
  // source sidesteps that entirely.
  @IsOptional()
  @Transform(({ obj, key }) => parseBool(obj[key]))
  @IsBoolean()
  deleted?: boolean;
}
