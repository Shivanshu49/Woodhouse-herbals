import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeIndianPhone } from '../../../common/utils/phone';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
// Normalises to +91XXXXXXXXXX; invalid inputs pass through unchanged so the
// @Matches below rejects them with a friendly message.
const phone = ({ value }: { value: unknown }) => normalizeIndianPhone(value) ?? value;

export class RegisterDto {
  @Transform(lower)
  @IsEmail({}, { message: 'Enter a valid email' })
  @MaxLength(254)
  email!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(80)
  // Letters (incl. accents), spaces, dots, hyphens, apostrophes.
  // Rejects angle brackets, scripts, control characters.
  @Matches(/^[\p{L}\p{M}\s.'\-]+$/u, { message: 'Name contains invalid characters' })
  fullName!: string;

  @IsString()
  @MinLength(10, { message: 'Password must be at least 10 characters' })
  @MaxLength(128, { message: 'Password is too long' })
  password!: string;
}

export class LoginDto {
  @Transform(lower)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class VerifyEmailDto {
  @IsString()
  @MinLength(20)
  @MaxLength(256)
  token!: string;
}

export class ForgotPasswordDto {
  @Transform(lower)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(20)
  @MaxLength(256)
  token!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;
}

export class RequestOtpDto {
  @Transform(phone)
  @IsString()
  @Matches(/^\+91[6-9]\d{9}$/, { message: 'Enter a valid Indian mobile number' })
  phone!: string;
}

export class VerifyOtpDto {
  @Transform(phone)
  @IsString()
  @Matches(/^\+91[6-9]\d{9}$/, { message: 'Enter a valid Indian mobile number' })
  phone!: string;

  @Transform(trim)
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code' })
  code!: string;

  // Only used when the phone number has no account yet.
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[\p{L}\p{M}\s.'\-]+$/u, { message: 'Name contains invalid characters' })
  fullName?: string;
}

export class GoogleAuthDto {
  // The ID token ("credential") produced by Google Identity Services.
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  credential!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  newPassword!: string;
}
