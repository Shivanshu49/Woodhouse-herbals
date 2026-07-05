import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryReason, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { stockFlagsFor } from './stock-flags';
import { isLowStock } from './inventory-flags';

interface AdjustInput {
  productId: string;
  delta: number; // signed: -ve for sales/reserves, +ve for intake/returns
  reason: InventoryReason;
  actorId?: string | null;
  // `reference` is reserved for a genuine order NUMBER (order flows) so history
  // can resolve an order link from it; free-form admin context goes in `note`.
  reference?: string | null;
  note?: string | null;
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
          note: input.note ?? undefined,
        },
      });

      return { previousQty: before.stockQty, newQty };
    };

    return input.tx ? run(input.tx) : this.prisma.$transaction(run);
  }

  /**
   * Manual, admin-initiated stock adjustment. Thin wrapper over `adjust` that
   * defaults the reason to MANUAL_ADJUSTMENT and stores the admin note in the
   * `note` column — NOT `reference`, which is reserved for order numbers so a
   * note that happens to look like an order id can't forge an order link.
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
      note: input.note ?? null,
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

  /** Stock overview — all tracked products with a per-product low-stock flag. */
  async overview(params: { q?: string; lowStockOnly?: boolean; page?: number; perPage?: number }) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 100) : 25;

    const where: Prisma.ProductWhereInput = { deletedAt: null };
    if (params.q) {
      where.OR = [
        { name: { contains: params.q, mode: 'insensitive' } },
        { sku: { contains: params.q, mode: 'insensitive' } },
      ];
    }
    if (params.lowStockOnly) {
      // Per-product threshold needs a column-vs-column compare Prisma can't express.
      const low = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Product"
        WHERE "deletedAt" IS NULL AND "trackInventory" = true AND "stockQty" <= "lowStockThreshold"`;
      where.id = { in: low.map((r) => r.id) };
    }

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: [{ stockQty: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true, name: true, sku: true, thumbnailUrl: true,
          stockQty: true, lowStockThreshold: true, stockStatus: true,
          inStock: true, trackInventory: true,
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const items = rows.map((p) => ({ ...p, isLow: isLowStock(p) }));
    return { items, total, page, perPage };
  }

  /** Full movement history for a product with resolved actor names + order links. */
  async history(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new NotFoundException('Product not found');

    const movements = await this.prisma.inventoryMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, previousQty: true, newQty: true, delta: true, reason: true,
        reference: true, note: true, orderId: true, createdBy: true, createdAt: true,
        actor: { select: { fullName: true } },
      },
    });

    // Resolve order links from either `orderId` or an order-number `reference`.
    const numbers = [...new Set(movements.map((m) => m.reference).filter((r): r is string => !!r))];
    const ids = [...new Set(movements.map((m) => m.orderId).filter((o): o is string => !!o))];
    const orders = await this.prisma.order.findMany({
      where: { OR: [{ number: { in: numbers } }, { id: { in: ids } }] },
      select: { id: true, number: true },
    });
    const byNumber = new Map(orders.map((o) => [o.number, o]));
    const byId = new Map(orders.map((o) => [o.id, o]));

    return movements.map((m) => {
      const order = (m.orderId && byId.get(m.orderId)) || (m.reference && byNumber.get(m.reference)) || null;
      // `reference` doubles as an order number (order flows) OR a free-form note
      // (manual adjust routes its note here). If it isn't an order, show it as a note.
      const note = m.note ?? (order ? null : m.reference);
      return {
        id: m.id,
        previousQty: m.previousQty,
        newQty: m.newQty,
        delta: m.delta,
        reason: m.reason,
        note,
        actorName: m.actor?.fullName ?? m.createdBy ?? null,
        order: order ? { id: order.id, number: order.number } : null,
        createdAt: m.createdAt,
      };
    });
  }
}
