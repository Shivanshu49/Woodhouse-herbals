import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async decrement(productId: string, qty: number) {
    return this.prisma.product.update({
      where: { id: productId },
      data: { stockQty: { decrement: qty }, inStock: { set: true } },
    });
  }

  lowStock(threshold = 5) {
    return this.prisma.product.findMany({
      where: { stockQty: { lte: threshold } },
      select: { id: true, name: true, sku: true, stockQty: true },
      orderBy: { stockQty: 'asc' },
    });
  }
}
