import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { excludeDeleted } from '../../common/prisma/soft-delete';
import { AddToCartDto } from './dto/cart.dto';
import { toMoney } from '../../common/utils/money';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(sessionId: string) {
    return (
      (await this.prisma.cart.findUnique({ where: { sessionId }, include: this.include })) ??
      this.prisma.cart.create({ data: { sessionId }, include: this.include })
    );
  }

  async show(sessionId: string) {
    return this.toResponse(await this.getOrCreate(sessionId));
  }

  async addLine(sessionId: string, dto: AddToCartDto) {
    const cart = await this.getOrCreate(sessionId);
    // findFirst (not findUnique) so the soft-delete filter applies — a
    // deleted product must not be addable to a cart.
    const product = await this.prisma.product.findFirst({
      where: excludeDeleted({ id: dto.productId }),
    });
    if (!product) throw new NotFoundException('Product not found');
    if (!product.inStock) throw new NotFoundException('Product is out of stock');

    // Hard cap so a single line cannot drain inventory or be abused for
    // arbitrarily expensive checkout payloads.
    const MAX_PER_LINE = 20;
    const requested = Math.min(dto.quantity, MAX_PER_LINE);

    await this.prisma.cartLine.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: product.id } },
      create: {
        cartId: cart.id,
        productId: product.id,
        quantity: requested,
        // Snapshot the current price — the order/checkout layer will revalidate
        // against the live price before charging.
        unitPriceMinor: product.priceMinor,
      },
      update: {
        quantity: { increment: requested },
      },
    });

    // Re-cap if increment pushed us above the limit.
    await this.prisma.cartLine.updateMany({
      where: { cartId: cart.id, productId: product.id, quantity: { gt: MAX_PER_LINE } },
      data: { quantity: MAX_PER_LINE },
    });

    return this.toResponse(await this.getOrCreate(sessionId));
  }

  async setQuantity(sessionId: string, productId: string, quantity: number) {
    const cart = await this.getOrCreate(sessionId);
    if (quantity <= 0) {
      await this.prisma.cartLine.deleteMany({ where: { cartId: cart.id, productId } });
    } else {
      await this.prisma.cartLine.update({
        where: { cartId_productId: { cartId: cart.id, productId } },
        data: { quantity },
      });
    }
    return this.toResponse(await this.getOrCreate(sessionId));
  }

  async clear(sessionId: string) {
    const cart = await this.getOrCreate(sessionId);
    await this.prisma.cartLine.deleteMany({ where: { cartId: cart.id } });
    return this.toResponse(await this.getOrCreate(sessionId));
  }

  private include = {
    lines: { include: { product: true } },
  } as const;

  private toResponse(cart: any) {
    const lines = cart.lines.map((l: any) => ({
      productId: l.productId,
      slug: l.product.slug,
      name: l.product.name,
      thumbnail: l.product.thumbnailUrl,
      unitPrice: toMoney(l.unitPriceMinor),
      quantity: l.quantity,
      lineTotal: toMoney(l.unitPriceMinor * l.quantity),
    }));
    const subtotal = lines.reduce((acc: number, l: any) => acc + l.lineTotal.amount, 0);
    const shipping = subtotal >= 49900 ? 0 : 5900;
    return {
      id: cart.id,
      lines,
      subtotal: toMoney(subtotal),
      discount: toMoney(0),
      shipping: toMoney(shipping),
      total: toMoney(subtotal + shipping),
      itemCount: lines.reduce((acc: number, l: any) => acc + l.quantity, 0),
    };
  }
}
