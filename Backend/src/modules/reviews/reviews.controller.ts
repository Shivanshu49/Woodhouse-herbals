import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/review.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/auth-types';

const ID_RE = /^[a-z0-9_-]{8,40}$/i;

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get('product/:productId')
  list(@Param('productId') productId: string) {
    if (!ID_RE.test(productId)) throw new BadRequestException('Invalid product id');
    return this.reviews.listForProduct(productId);
  }

  /**
   * Authenticated users only. 5 reviews per hour per user — well above
   * any legitimate use, low enough to slow scraping/abuse.
   *
   * Reviews are created `approved: false` and require moderation before
   * appearing publicly (defence against UGC injection / SEO spam).
   */
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60 * 60 * 1000, limit: 5 } })
  @Post()
  create(@Body() dto: CreateReviewDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reviews.create(user.sub, dto);
  }

  // ──────────────────────────────────────────────────────────────────
  // Admin moderation
  // ──────────────────────────────────────────────────────────────────

  /** The moderation queue: reviews awaiting approval. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get('pending')
  pending() {
    return this.reviews.listPending();
  }

  /** Approve a review and refresh the product's rating aggregates. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Post(':id/approve')
  approve(@Param('id') id: string) {
    if (!ID_RE.test(id)) throw new BadRequestException('Invalid review id');
    return this.reviews.approve(id);
  }
}
