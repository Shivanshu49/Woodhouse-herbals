import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { InventoryReason, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateOrderDto } from './dto/order.dto';

interface OwnershipContext {
  userId?: string;
  role?: UserRole;
  sessionId?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carts: CartService,
    private readonly inventory: InventoryService,
  ) {}

  /**
   * Create an order from the current cart.
   *
   * Invariants:
   * - Prices are recomputed from the live `Product.priceMinor` — the cart
   *   line snapshot is treated as untrusted display state.
   * - Inventory is decremented atomically inside a transaction with a
   *   conditional update (`stockQty >= qty`) so concurrent orders for the
   *   same SKU cannot oversell.
   * - The order is created in PENDING. The cart is NOT cleared here —
   *   PhonePe callback will clear it on PAID, or restore stock on FAILED.
   */
  async createFromCart(
    sessionId: string,
    userId: string | undefined,
    dto: CreateOrderDto,
    idempotencyKey?: string,
  ) {
    // Network retries can re-send POST /api/orders. If the client provided
    // an Idempotency-Key, replay the previous result instead of creating
    // duplicate orders and double-decrementing stock.
    if (idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey },
        include: { items: true },
      });
      if (existing) return existing;
    }
    const cart = await this.carts.getOrCreate(sessionId);
    if (!cart.lines.length) throw new BadRequestException('Cart is empty');

    const productIds = cart.lines.map((l: { productId: string }) => l.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const byId = new Map(products.map((p) => [p.id, p] as const));

    // Validate every line before touching inventory.
    for (const line of cart.lines as Array<{ productId: string; quantity: number }>) {
      const p = byId.get(line.productId);
      if (!p) throw new BadRequestException('A product in your cart is no longer available');
      if (!p.inStock) throw new ConflictException(`${p.name} is out of stock`);
      if (p.stockQty < line.quantity) {
        throw new ConflictException(
          `Only ${p.stockQty} of ${p.name} left — please reduce the quantity`,
        );
      }
    }

    // Recompute totals from live prices.
    const subtotal = (cart.lines as Array<{ productId: string; quantity: number }>).reduce(
      (acc, l) => acc + byId.get(l.productId)!.priceMinor * l.quantity,
      0,
    );
    const shipping = subtotal >= 49900 ? 0 : 5900;
    const total = subtotal + shipping;
    const number = `WH-${Date.now().toString(36).toUpperCase()}${randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;

    const order = await this.prisma.$transaction(async (tx) => {
      // Decrement stock via InventoryService so each change leaves an
      // immutable audit row in the same transaction.
      for (const line of cart.lines as Array<{ productId: string; quantity: number }>) {
        await this.inventory.adjust({
          productId: line.productId,
          delta: -line.quantity,
          reason: InventoryReason.ORDER_RESERVED,
          actorId: userId ?? null,
          reference: number,
          tx,
        });
      }

      return tx.order.create({
        data: {
          number,
          userId,
          cartSessionId: sessionId,
          idempotencyKey,
          status: 'PENDING',
          subtotalMinor: subtotal,
          discountMinor: 0,
          shippingMinor: shipping,
          totalMinor: total,
          shippingFullName: dto.fullName,
          shippingPhone: dto.phone,
          shippingLine1: dto.line1,
          shippingLine2: dto.line2,
          shippingCity: dto.city,
          shippingState: dto.state,
          shippingPincode: dto.pincode,
          shippingCountry: dto.country ?? 'IN',
          items: {
            create: (cart.lines as Array<{ productId: string; quantity: number }>).map((l) => {
              const p = byId.get(l.productId)!;
              return {
                productId: p.id,
                // Immutable snapshots — survive future product edits/deletes.
                productNameSnapshot: p.name,
                productImageSnapshot: p.thumbnailUrl,
                skuSnapshot: p.sku,
                quantity: l.quantity,
                unitPriceMinor: p.priceMinor,
                lineTotalMinor: p.priceMinor * l.quantity,
              };
            }),
          },
        },
        include: { items: true },
      });
    });

    return order;
  }

  /**
   * Fetches an order only if the caller owns it (or is staff/admin).
   * Returns 404 on ownership mismatch so attackers can't probe for the
   * existence of unrelated orders.
   */
  async findOwnedByNumber(number: string, ctx: OwnershipContext) {
    const order = await this.prisma.order.findUnique({
      where: { number },
      include: { items: true, payments: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const isStaff = ctx.role === UserRole.ADMIN || ctx.role === UserRole.STAFF;
    if (isStaff) return order;

    if (ctx.userId && order.userId === ctx.userId) return order;

    throw new NotFoundException('Order not found');
  }

  async listForUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { placedAt: 'desc' },
      include: { items: true },
    });
  }

  async adminFindByNumber(number: string) {
    const order = await this.prisma.order.findUnique({
      where: { number },
      include: { items: true, payments: true },
    });
    if (!order) throw new ForbiddenException();
    return order;
  }
}
