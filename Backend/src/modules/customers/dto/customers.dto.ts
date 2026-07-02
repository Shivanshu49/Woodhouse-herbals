import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { SkinType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Same allow-lists the checkout DTO uses (orders/dto/order.dto.ts) so an
// address accepted here is also accepted at checkout.
const INDIAN_PINCODE = /^[1-9]\d{5}$/;
const INDIAN_MOBILE = /^[6-9]\d{9}$/;
const ADDRESS_RE = /^[\p{L}\p{M}\p{N}\s,.'/\-#&()]+$/u;
const NAME_RE = /^[\p{L}\p{M}\s.'\-]+$/u;

// NOTE: `phone` is deliberately NOT part of the profile update — it is a
// login identifier for the OTP flow, so changing it requires possession
// proof via POST /auth/phone-change/{request,verify}.
export class UpdateProfileDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(80)
  @Matches(NAME_RE, { message: 'Name contains invalid characters' })
  fullName?: string;

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
