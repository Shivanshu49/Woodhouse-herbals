import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { InventoryReason } from '@prisma/client';

// Reasons a HUMAN may set from the manual-adjust endpoint. The automated
// order/refund/seed reasons (ORDER_*, INITIAL_SEED) are written ONLY by their
// service flows (which call inventory.adjust directly), never via this endpoint —
// so a client can't forge an order/seed movement with no order behind it.
const MANUAL_REASONS: InventoryReason[] = [
  InventoryReason.RESTOCK,
  InventoryReason.STOCK_INTAKE,
  InventoryReason.MANUAL_ADJUSTMENT,
  InventoryReason.MANUAL_ADJUST,
  InventoryReason.RECONCILIATION,
  InventoryReason.DAMAGED,
  InventoryReason.RETURNED,
  InventoryReason.RETURN,
];

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

  // Defaults to MANUAL_ADJUSTMENT in the service when omitted. Restricted to the
  // human-settable reasons — automated ORDER_*/INITIAL_SEED reasons are off-limits
  // here so the ledger's reason semantics can't be forged.
  @IsOptional()
  @IsIn(MANUAL_REASONS)
  reason?: InventoryReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
