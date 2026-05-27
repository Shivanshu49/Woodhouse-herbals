import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/order.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/auth-types';
import { SESSION_COOKIE } from '../../common/auth/auth-types';
import { Public } from '../../common/decorators/public.decorator';

const ORDER_NUMBER_RE = /^WH-[A-Z0-9]{6,32}$/;

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /**
   * Guest checkout is allowed (cart session cookie identifies the buyer), but
   * if an authenticated user is present we tie the order to their account.
   */
  @Public()
  @Post()
  create(@Body() dto: CreateOrderDto, @Req() req: Request) {
    const sessionId = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    if (!sessionId) throw new BadRequestException('No cart session');
    const userId = req.user?.sub;
    return this.orders.createFromCart(sessionId, userId, dto);
  }

  /**
   * Order detail is owner-only. Admins and staff can view any order. Guests
   * who placed the order can fetch it for the lifetime of their session cookie.
   */
  @UseGuards(JwtAuthGuard)
  @Get(':number')
  byNumber(
    @Param('number') number: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    if (!ORDER_NUMBER_RE.test(number)) throw new BadRequestException('Invalid order number');
    const sessionId = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    return this.orders.findOwnedByNumber(number, {
      userId: user.sub,
      role: user.role,
      sessionId,
    });
  }

  /** List the authenticated user's own orders only. */
  @UseGuards(JwtAuthGuard)
  @Get()
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.listForUser(user.sub);
  }
}

export { UserRole };
