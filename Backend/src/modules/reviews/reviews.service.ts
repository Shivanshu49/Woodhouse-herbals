import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  listForProduct(productId: string) {
    return this.prisma.review.findMany({
      where: { productId, approved: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        authorName: true,
        verifiedPurchase: true,
        createdAt: true,
      },
    });
  }

  async create(userId: string, dto: CreateReviewDto) {
    // Validate the product exists — protects against creating orphan rows.
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    // verifiedPurchase is server-side derived: did this user actually buy it?
    const purchased = await this.prisma.orderItem.count({
      where: {
        productId: dto.productId,
        order: { userId, status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
      },
    });

    return this.prisma.review.create({
      data: {
        productId: dto.productId,
        userId,
        authorName: dto.authorName,
        rating: dto.rating,
        title: dto.title,
        body: dto.body,
        verifiedPurchase: purchased > 0,
        approved: false, // moderation queue
      },
    });
  }
}
