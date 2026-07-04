import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { InventoryReason } from '@prisma/client';

/**
 * Manual stock adjustment issued from the admin panel.
 *
 * `delta` is signed: +ve for intake / restock / upward correction, -ve for
 * shrinkage / downward correction. A zero delta is rejected downstream by
 * InventoryService.adjust (it would write a no-op ledger row).
 *
 * There is deliberately no way to set `stockQty` absolutely anywhere in the
 * product API — every change flows through this endpoint so the
 * InventoryMovement ledger and the CAS concurrency guard remain authoritative.
 */
export class AdjustStockDto {
  @IsString()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  delta!: number;

  // Defaults to MANUAL_ADJUSTMENT in the service when omitted. We accept the
  // full enum (not just the manual reasons) so Phase D can reuse this endpoint
  // for reconciliation / damage / return flows.
  @IsOptional()
  @IsEnum(InventoryReason)
  reason?: InventoryReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
