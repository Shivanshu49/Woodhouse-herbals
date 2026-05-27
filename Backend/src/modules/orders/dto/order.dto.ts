import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const INDIAN_PINCODE = /^[1-9]\d{5}$/;
const INDIAN_MOBILE = /^[6-9]\d{9}$/;
// Strict character allow-list for free-form address lines — letters (incl.
// non-Latin), digits, common address punctuation. Stops control characters,
// HTML/JS payloads, and unicode tricks like RTL overrides.
const ADDRESS_RE = /^[\p{L}\p{M}\p{N}\s,.'/\-#&()]+$/u;
const NAME_RE = /^[\p{L}\p{M}\s.'\-]+$/u;

export class CreateOrderDto {
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
}
