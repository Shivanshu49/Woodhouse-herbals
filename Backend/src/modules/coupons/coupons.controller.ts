import { BadRequestException, Body, Controller, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CouponsService } from './coupons.service';
import { PreviewCouponDto } from './dto/coupon.dto';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SESSION_COOKIE } from '../../common/auth/auth-types';

@Controller('coupons')
export class CouponsController {
  constructor(
    private readonly coupons: CouponsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Quote a discount for the current cart without consuming a coupon use.
   * Public — guest carts can preview too. Throttled because a coupon-code
   * lookup is the cheapest way to enumerate active codes.
   *
   * Coupon MANAGEMENT lives on AdminCouponsController (/admin/coupons); this
   * controller stays the public preview surface only.
   */
  @Public()
  @Throttle({ default: { ttl: 60 * 1000, limit: 20 } })
  @Post('preview')
  async preview(@Body() dto: PreviewCouponDto, @Req() req: Request) {
    const sessionId = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    if (!sessionId) throw new BadRequestException('No cart session');

    const cart = await this.prisma.cart.findUnique({
      where: { sessionId },
      include: { lines: { include: { product: true } } },
    });
    if (!cart || cart.lines.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    return this.coupons.preview({
      code: dto.code,
      userId: req.user?.sub,
      lines: cart.lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPriceMinor: l.product.priceMinor,
        category: l.product.categoryRefId ?? '',
      })),
    });
  }
}
