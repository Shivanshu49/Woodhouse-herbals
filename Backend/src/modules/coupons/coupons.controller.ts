import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, PreviewCouponDto } from './dto/coupon.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
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

  // ──────────────────────────────────────────────────────────────────
  // Admin
  // ──────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get()
  list() {
    return this.coupons.list();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateCouponDto) {
    return this.coupons.create({
      code: dto.code,
      kind: dto.kind,
      value: dto.value,
      maxDiscountMinor: dto.maxDiscountMinor ?? null,
      minCartMinor: dto.minCartMinor ?? 0,
      maxUses: dto.maxUses ?? null,
      perUserLimit: dto.perUserLimit ?? null,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      active: dto.active ?? true,
      categories: dto.categoryIds?.length
        ? { create: dto.categoryIds.map((id) => ({ category: { connect: { id } } })) }
        : undefined,
      concerns: dto.concernIds?.length
        ? { create: dto.concernIds.map((id) => ({ concern: { connect: { id } } })) }
        : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async deactivate(@Param('id') id: string) {
    await this.coupons.deactivate(id);
    return { ok: true };
  }
}
