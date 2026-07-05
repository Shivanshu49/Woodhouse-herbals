import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Store-profile PATCH — all fields optional. Shape/whitelist only; the business
 * rules (GSTIN/state/rate) are enforced by validateStoreProfilePatch. `stateCode`
 * is intentionally NOT accepted — it is derived from `state`, never trusted.
 */
export class UpdateStoreProfileDto {
  @IsOptional() @IsString() @MaxLength(200) legalName?: string;
  @IsOptional() @IsString() @MaxLength(20) gstin?: string;
  @IsOptional() @IsString() @MaxLength(20) pan?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(100) state?: string;
  @IsOptional() @IsInt() shippingGstRate?: number;
}
