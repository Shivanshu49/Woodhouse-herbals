import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Hero banners ──────────────────────────────────────────────────────
// eyebrow/subtitle are non-null in the schema but may be intentionally blank,
// so they're required-present (@IsString) without a MinLength.

export class CreateBannerDto {
  @IsString() @MaxLength(160) eyebrow!: string;
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsString() @MaxLength(400) subtitle!: string;
  @IsString() @MinLength(1) @MaxLength(80) ctaLabel!: string;
  @IsString() @MinLength(1) @MaxLength(500) ctaHref!: string;
  @IsString() @MinLength(1) @MaxLength(600) imageUrl!: string;
  @IsOptional() @IsString() @MaxLength(40) accent?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsISO8601() startsAt?: string;
  @IsOptional() @IsISO8601() endsAt?: string;
}

export class UpdateBannerDto {
  @IsOptional() @IsString() @MaxLength(160) eyebrow?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(400) subtitle?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) ctaLabel?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(500) ctaHref?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(600) imageUrl?: string;
  // Empty string clears the accent.
  @IsOptional() @IsString() @MaxLength(40) accent?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  // Empty string clears the bound; a valid ISO string sets it.
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() endsAt?: string;
}

// ── Offer strip items ─────────────────────────────────────────────────

export class CreateOfferStripItemDto {
  @IsString() @MinLength(1) @MaxLength(200) headline!: string;
  @IsOptional() @IsString() @MaxLength(40) code?: string;
  @IsOptional() @IsString() @MaxLength(500) href?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsISO8601() startsAt?: string;
  @IsOptional() @IsISO8601() endsAt?: string;
}

export class UpdateOfferStripItemDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) headline?: string;
  @IsOptional() @IsString() @MaxLength(40) code?: string;
  @IsOptional() @IsString() @MaxLength(500) href?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() endsAt?: string;
}

// ── Testimonials ──────────────────────────────────────────────────────

export class CreateTestimonialDto {
  @IsString() @MinLength(1) @MaxLength(120) authorName!: string;
  @IsOptional() @IsString() @MaxLength(160) authorMeta?: string;
  @IsOptional() @IsString() @MaxLength(600) avatarUrl?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) rating?: number;
  @IsString() @MinLength(1) @MaxLength(2000) body!: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateTestimonialDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) authorName?: string;
  @IsOptional() @IsString() @MaxLength(160) authorMeta?: string;
  @IsOptional() @IsString() @MaxLength(600) avatarUrl?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) rating?: number;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(2000) body?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

// ── FAQs ──────────────────────────────────────────────────────────────

export class CreateFaqDto {
  @IsString() @MinLength(1) @MaxLength(300) question!: string;
  @IsString() @MinLength(1) @MaxLength(4000) answer!: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateFaqDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(300) question?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(4000) answer?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

// ── Static pages ──────────────────────────────────────────────────────

export class CreateStaticPageDto {
  @IsString() @MinLength(1) @MaxLength(140) slug!: string;
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsString() @MaxLength(100000) bodyHtml!: string;
  @IsOptional() @IsString() @MaxLength(200) metaTitle?: string;
  @IsOptional() @IsString() @MaxLength(400) metaDescription?: string;
  @IsOptional() @IsBoolean() published?: boolean;
}

export class UpdateStaticPageDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(140) slug?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(100000) bodyHtml?: string;
  @IsOptional() @IsString() @MaxLength(200) metaTitle?: string;
  @IsOptional() @IsString() @MaxLength(400) metaDescription?: string;
  @IsOptional() @IsBoolean() published?: boolean;
}

// ── Shared reorder payload (drag-to-sort) ─────────────────────────────

class ReorderItem {
  @IsString() id!: string;
  @IsInt() @Min(0) sortOrder!: number;
}

export class ReorderDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  items!: ReorderItem[];
}
