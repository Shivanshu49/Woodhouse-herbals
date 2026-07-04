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
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { BadgeTone, GstRate, ProductCategory, ProductStatus, RecommendationKind, SkinType } from '@prisma/client';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Money columns (priceMinor etc.) are 32-bit signed Int in Postgres; cap so an
// out-of-range amount is a clean 400, not an "integer out of range" 500.
const INT4_MAX = 2_147_483_647;

export class GalleryItemDto {
  @IsString()
  url!: string;

  @IsString()
  alt!: string;

  @IsOptional()
  @IsInt()
  width?: number;

  @IsOptional()
  @IsInt()
  height?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class IngredientItemDto {
  @IsString()
  name!: string;

  @IsString()
  benefit!: string;

  @IsOptional()
  @IsString()
  iconUrl?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class BenefitItemDto {
  @IsString()
  text!: string;

  @IsOptional()
  @IsString()
  iconUrl?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class BadgeItemDto {
  @IsString()
  label!: string;

  @IsEnum(BadgeTone)
  tone!: BadgeTone;
}

export class RecommendationItemDto {
  @IsString()
  targetProductId!: string;

  @IsOptional()
  @IsEnum(RecommendationKind)
  kind?: RecommendationKind;

  @IsOptional()
  @IsNumber()
  score?: number;
}

/**
 * The full product shape. Scope decision (locked with the owner): variants
 * are deferred, so there is no `variants` field here — only the base
 * product's own stock (`stockQty`, create-only; edits go through the
 * Inventory module in a later phase).
 */
export class CreateProductDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @Matches(SLUG_RE, { message: 'slug must be lowercase, dash-separated (e.g. "vitamin-c-serum")' })
  slug!: string;

  @IsString()
  @MaxLength(64)
  sku!: string;

  @IsString()
  @MaxLength(400)
  shortDescription!: string;

  @IsString()
  longDescription!: string;

  @IsEnum(ProductCategory)
  category!: ProductCategory;

  @IsInt()
  @Min(0)
  @Max(INT4_MAX)
  priceMinor!: number;

  @IsString()
  thumbnailUrl!: string;

  @IsString()
  thumbnailAlt!: string;

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
  @Max(INT4_MAX)
  compareAtPriceMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(INT4_MAX)
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

  // CREATE ONLY — subsequent stock changes go through the Inventory module
  // (InventoryService.adjust), never through UpdateProductDto.
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;

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

  // Legacy free-text benefits — accept for back-compat, prefer benefitItems.
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

  // → ProductConcern rows.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  concernIds?: string[];

  // → ProductCategoryLink rows; the first id in the array becomes isPrimary.
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
