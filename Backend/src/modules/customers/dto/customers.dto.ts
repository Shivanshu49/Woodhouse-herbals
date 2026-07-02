import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { SkinType } from '@prisma/client';
import { normalizeIndianPhone } from '../../../common/utils/phone';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const phone = ({ value }: { value: unknown }) => normalizeIndianPhone(value) ?? value;

// Same allow-lists the checkout DTO uses (orders/dto/order.dto.ts) so an
// address accepted here is also accepted at checkout.
const INDIAN_PINCODE = /^[1-9]\d{5}$/;
const INDIAN_MOBILE = /^[6-9]\d{9}$/;
const ADDRESS_RE = /^[\p{L}\p{M}\p{N}\s,.'/\-#&()]+$/u;
const NAME_RE = /^[\p{L}\p{M}\s.'\-]+$/u;

export class UpdateProfileDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(80)
  @Matches(NAME_RE, { message: 'Name contains invalid characters' })
  fullName?: string;

  @Transform(phone)
  @IsOptional()
  @IsString()
  @Matches(/^\+91[6-9]\d{9}$/, { message: 'Enter a valid Indian mobile number' })
  phone?: string;

  @IsOptional()
  @IsIn(Object.values(SkinType))
  skinType?: SkinType;

  @IsOptional()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  primaryConcerns?: string[];
}

export class AddressDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(NAME_RE, { message: 'Name contains invalid characters' })
  fullName!: string;

  @Transform(trim)
  @IsString()
  @Matches(INDIAN_MOBILE, { message: 'Invalid Indian mobile number' })
  phone!: string;

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  @Matches(ADDRESS_RE, { message: 'Address contains invalid characters' })
  line1!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Matches(ADDRESS_RE, { message: 'Address contains invalid characters' })
  line2?: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(NAME_RE, { message: 'City contains invalid characters' })
  city!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(NAME_RE, { message: 'State contains invalid characters' })
  state!: string;

  @Transform(trim)
  @IsString()
  @Matches(INDIAN_PINCODE, { message: 'Invalid Indian pincode' })
  pincode!: string;

  @IsOptional()
  @IsIn(['IN'])
  country?: 'IN';

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
