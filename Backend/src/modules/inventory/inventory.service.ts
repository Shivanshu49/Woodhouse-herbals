import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryReason, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

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
 *      update against the previously-observed value, and
 *   2) writes an `InventoryMovement` row in the same transaction.
 *
 * If either step fails the whole transaction rolls back.
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
      const updated = await tx.product.updateMany({
        where: { id: input.productId, stockQty: before.stockQty },
        data: { stockQty: newQty },
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
