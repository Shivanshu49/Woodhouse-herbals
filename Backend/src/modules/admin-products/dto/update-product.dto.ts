import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { GstRate, ProductCategory, ProductStatus, SkinType } from '@prisma/client';
import { BadgeItemDto, BenefitItemDto, GalleryItemDto, IngredientItemDto, RecommendationItemDto } from './create-product.dto';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Same shape as CreateProductDto, but EVERY field is optional and — this is
 * the important part — it does NOT declare `stockQty`, `rating`, or
 * `reviewCount`. The global ValidationPipe runs with
 * `whitelist + forbidNonWhitelisted`, so any request body carrying one of
 * those keys is rejected with 400 before it reaches the service:
 *   - stockQty is inventory-owned (InventoryService.adjust), not editable
 *     via a product PATCH.
 *   - rating / reviewCount are review-owned, derived from Review rows.
 *
 * Hand-written rather than `PartialType(CreateProductDto)` on purpose —
 * PartialType would re-admit stockQty as an optional field.
 */
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(SLUG_RE, { message: 'slug must be lowercase, dash-separated (e.g. "vitamin-c-serum")' })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  longDescription?: string;

  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceMinor?: number;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  thumbnailAlt?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsBoolean()
  isCombo?: boolean;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  compareAtPriceMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  costPriceMinor?: number;

  @IsOptional()
  @IsEnum(GstRate)
  gstRate?: GstRate;

  @IsOptional()
  @IsString()
  hsnCode?: string;

  @IsOptional()
  @IsDateString()
  saleStartsAt?: string;

  @IsOptional()
  @IsDateString()
  saleEndsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsBoolean()
  allowBackorder?: boolean;

  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  parabenFree?: boolean;

  @IsOptional()
  @IsBoolean()
  sulfateFree?: boolean;

  @IsOptional()
  @IsBoolean()
  crueltyFree?: boolean;

  @IsOptional()
  @IsBoolean()
  vegan?: boolean;

  @IsOptional()
  @IsBoolean()
  alcoholFree?: boolean;

  @IsOptional()
  @IsString()
  inciText?: string;

  @IsOptional()
  @IsString()
  usageFrequency?: string;

  @IsOptional()
  @IsString()
  recommendedTime?: string;

  @IsOptional()
  @IsString()
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsOptional()
  @IsString()
  focusKeyword?: string;

  @IsOptional()
  @IsString()
  ogImageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  weightGrams?: number;

  @IsOptional()
  @IsNumber()
  lengthCm?: number;

  @IsOptional()
  @IsNumber()
  widthCm?: number;

  @IsOptional()
  @IsNumber()
  heightCm?: number;

  @IsOptional()
  @IsString()
  shippingClass?: string;

  @IsOptional()
  @IsBoolean()
  freeShipping?: boolean;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsDateString()
  publishAt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  howToUse?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(SkinType, { each: true })
  skinTypes?: SkinType[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GalleryItemDto)
  gallery?: GalleryItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredientItemDto)
  ingredients?: IngredientItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BenefitItemDto)
  benefitItems?: BenefitItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BadgeItemDto)
  badges?: BadgeItemDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  concernIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecommendationItemDto)
  recommendations?: RecommendationItemDto[];
}
