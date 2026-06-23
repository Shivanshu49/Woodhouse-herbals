import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  // ──────────────────────────────────────────────────────────────────
  // Admin moderation (RBAC-guarded by the controller)
  // ──────────────────────────────────────────────────────────────────

  /** Reviews awaiting moderation, oldest first (FIFO queue). */
  listPending() {
    return this.prisma.review.findMany({
      where: { approved: false, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        productId: true,
        rating: true,
        title: true,
        body: true,
        authorName: true,
        verifiedPurchase: true,
        createdAt: true,
      },
    });
  }

  /**
   * Approve a review and recompute the parent product's denormalised
   * rating/reviewCount from the now-approved set — both in one transaction so
   * the product aggregates can never drift from the visible reviews.
   */
  async approve(id: string) {
    const review = await this.prisma.review.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, productId: true, approved: true },
    });
    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({
        where: { id },
        data: { approved: true },
      });
      await this.recomputeProductRating(tx, review.productId);
      return updated;
    });
  }

  /**
   * Recompute Product.rating (1-decimal avg) and reviewCount from the set of
   * approved, non-deleted reviews. Call inside a transaction after any change
   * to a review's approval/visibility.
   */
  private async recomputeProductRating(
    tx: Prisma.TransactionClient,
    productId: string,
  ): Promise<void> {
    const agg = await tx.review.aggregate({
      where: { productId, approved: true, deletedAt: null },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await tx.product.update({
      where: { id: productId },
      data: {
        rating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0,
        reviewCount: agg._count._all,
      },
    });
  }
}
