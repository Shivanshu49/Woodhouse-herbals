import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CouponKind } from '@prisma/client';

const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

const COUPON_CODE_RE = /^[A-Z0-9_-]{3,32}$/;

export class PreviewCouponDto {
  @Transform(upper)
  @IsString()
  @Matches(COUPON_CODE_RE, { message: 'Invalid coupon code' })
  code!: string;
}

export class CreateCouponDto {
  @Transform(upper)
  @IsString()
  @Matches(COUPON_CODE_RE)
  code!: string;

  @IsEnum(CouponKind)
  kind!: CouponKind;

  @IsInt()
  @Min(1)
  value!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxDiscountMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minCartMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  perUserLimit?: number;

  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  concernIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;
}
