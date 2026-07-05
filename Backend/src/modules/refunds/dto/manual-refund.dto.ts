import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { RefundDisposition } from '@prisma/client';

/**
 * COD manual refund body. `utrReference` is MANDATORY and non-empty — it is the
 * proof that the out-of-band bank/UPI transfer already happened, which is what
 * lets the manual refund record as PROCESSED immediately (no PENDING theater).
 */
export class ManualRefundDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  utrReference!: string;

  @IsEnum(RefundDisposition)
  disposition!: RefundDisposition;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
