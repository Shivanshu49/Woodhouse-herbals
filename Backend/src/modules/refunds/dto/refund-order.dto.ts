import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { RefundDisposition } from '@prisma/client';

/**
 * Prepaid (gateway) refund body. No UTR — the money moves through the gateway's
 * refund API, not an out-of-band transfer. `disposition` drives the restock
 * decision exactly like the COD path.
 */
export class RefundOrderDto {
  @IsEnum(RefundDisposition)
  disposition!: RefundDisposition;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
