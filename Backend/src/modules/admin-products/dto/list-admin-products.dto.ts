import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ProductCategory, ProductStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

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

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  deleted?: boolean;
}
