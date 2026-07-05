import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CouponKind } from '@prisma/client';

const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

const COUPON_CODE_RE = /^[A-Z0-9_-]{3,32}$/;
const INT4_MAX = 2_147_483_647;

export class PreviewCouponDto {
  @Transform(upper)
  @IsString()
  @Matches(COUPON_CODE_RE, { message: 'Invalid coupon code' })
  code!: string;
}

/**
 * Admin create. Deliberately scoped to what CouponsService.preview/redeem
 * actually enforces at checkout: PERCENT/FLAT discounts, a category restriction,
 * usage caps, and a schedule. The unenforced Coupon columns (eligibility,
 * concern/product restriction, CouponUser targeting, FREE_SHIPPING/BXGY kinds)
 * are intentionally NOT accepted — with the global ValidationPipe's
 * `forbidNonWhitelisted`, a client that sends any of them gets a 400 rather than
 * silently persisting config that does nothing. Enforcing those is a dedicated
 * future phase touching the redeem path (see fast-follows).
 */
export class CreateCouponDto {
  @Transform(upper)
  @IsString()
  @Matches(COUPON_CODE_RE)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  // FREE_SHIPPING / BXGY are rejected — computeDiscount treats them as FLAT, so
  // they'd grant a wrong discount. Only the two implemented kinds are allowed.
  @IsIn([CouponKind.PERCENT, CouponKind.FLAT])
  kind!: CouponKind;

  // PERCENT: 1..100 (enforced in the service against `kind`). FLAT: paise.
  @IsInt()
  @Min(1)
  @Max(INT4_MAX)
  value!: number;

  // PERCENT-only cap on the discount, in paise. Rejected for FLAT in the service.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(INT4_MAX)
  maxDiscountMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(INT4_MAX)
  minCartMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(INT4_MAX)
  maxUses?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  perUserLimit?: number;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  // The one applicability the redeem path honors. Empty/absent = whole-cart.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  categoryIds?: string[];
}

/** Admin edit. Same enforced field set, all optional; `code` is immutable
 *  (coupons are redeemed by code, so renaming one mid-life is disallowed). */
export class UpdateCouponDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsOptional()
  @IsIn([CouponKind.PERCENT, CouponKind.FLAT])
  kind?: CouponKind;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(INT4_MAX)
  value?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(INT4_MAX)
  maxDiscountMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(INT4_MAX)
  minCartMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(INT4_MAX)
  maxUses?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  perUserLimit?: number;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  categoryIds?: string[];
}

export class SetCouponActiveDto {
  @IsBoolean()
  active!: boolean;
}
