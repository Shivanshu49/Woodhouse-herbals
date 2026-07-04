import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryReason, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { stockFlagsFor } from './stock-flags';

interface AdjustInput {
  productId: string;
  delta: number; // signed: -ve for sales/reserves, +ve for intake/returns
  reason: InventoryReason;
  actorId?: string | null;
  reference?: string | null;
  /**
   * Optional Prisma transaction client. When called from inside an order
   * transaction, the audit row MUST be written in the same tx so a failure
   * rolls everything back together.
   */
  tx?: Prisma.TransactionClient;
}

/**
 * Inventory mutations + immutable audit log.
 *
 * Every stock change goes through `adjust` so we have a single point that
 *   1) enforces the `stockQty >= 0` invariant atomically via a conditional
 *      update against the previously-observed value,
 *   2) reconciles the denormalised `inStock` / `stockStatus` flags in the same
 *      update so the storefront never reads a sold-out product as available, and
 *   3) writes an `InventoryMovement` row in the same transaction.
 *
 * If any step fails the whole transaction rolls back.
 */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async adjust(input: AdjustInput): Promise<{ previousQty: number; newQty: number }> {
    if (input.delta === 0) throw new ConflictException('Delta must be non-zero');

    const run = async (tx: Prisma.TransactionClient) => {
      const before = await tx.product.findUnique({
        where: { id: input.productId },
        select: { stockQty: true },
      });
      if (!before) throw new NotFoundException('Product not found');

      const newQty = before.stockQty + input.delta;
      if (newQty < 0) throw new ConflictException('Insufficient stock');

      // CAS-style guard against concurrent updates that also read `before`.
      // The denormalized inStock/stockStatus flags are reconciled in the SAME
      // update so every stock path (order decrement, refund restore, admin
      // adjust) keeps them in sync with stockQty — a sold-out product must
      // never linger as inStock:true.
      const updated = await tx.product.updateMany({
        where: { id: input.productId, stockQty: before.stockQty },
        data: { stockQty: newQty, ...stockFlagsFor(newQty) },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Stock changed concurrently — please retry');
      }

      await tx.inventoryMovement.create({
        data: {
          productId: input.productId,
          previousQty: before.stockQty,
          newQty,
          delta: input.delta,
          reason: input.reason,
          actorId: input.actorId ?? undefined,
          reference: input.reference ?? undefined,
        },
      });

      return { previousQty: before.stockQty, newQty };
    };

    return input.tx ? run(input.tx) : this.prisma.$transaction(run);
  }

  /**
   * Manual, admin-initiated stock adjustment. Thin wrapper over `adjust` that
   * defaults the reason to MANUAL_ADJUSTMENT and maps the admin note onto the
   * ledger `reference`. Flag reconciliation now lives in `adjust` itself, so
   * this needs no extra transaction.
   */
  async adminAdjust(input: {
    productId: string;
    delta: number;
    actorId: string;
    reason?: InventoryReason;
    note?: string | null;
  }): Promise<{ previousQty: number; newQty: number }> {
    return this.adjust({
      productId: input.productId,
      delta: input.delta,
      reason: input.reason ?? InventoryReason.MANUAL_ADJUSTMENT,
      actorId: input.actorId,
      reference: input.note ?? null,
    });
  }

  lowStock(threshold = 5) {
    return this.prisma.product.findMany({
      where: { stockQty: { lte: threshold }, deletedAt: null },
      select: { id: true, name: true, sku: true, stockQty: true },
      orderBy: { stockQty: 'asc' },
    });
  }

  historyForProduct(productId: string, take = 100) {
    return this.prisma.inventoryMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        previousQty: true,
        newQty: true,
        delta: true,
        reason: true,
        reference: true,
        actorId: true,
        createdAt: true,
      },
    });
  }
}
