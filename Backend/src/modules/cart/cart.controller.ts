import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartLineDto } from './dto/cart.dto';
import { Public } from '../../common/decorators/public.decorator';
import { SESSION_COOKIE } from '../../common/auth/auth-types';
import { env } from '../../common/config/env';

const ID_RE = /^[a-z0-9_-]{8,40}$/i;
// UUID v4 with strict character class (no path traversal / encoded payloads).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Public()
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  async show(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sid = this.ensureSession(req, res);
    return this.cart.show(sid);
  }

  @Throttle({ default: { ttl: 60 * 1000, limit: 60 } })
  @Post('items')
  async add(@Body() dto: AddToCartDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sid = this.ensureSession(req, res);
    return this.cart.addLine(sid, dto);
  }

  @Put('items/:productId')
  async update(
    @Param('productId') productId: string,
    @Body() dto: UpdateCartLineDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!ID_RE.test(productId)) throw new BadRequestException('Invalid product id');
    const sid = this.ensureSession(req, res);
    return this.cart.setQuantity(sid, productId, dto.quantity);
  }

  @Delete()
  async clear(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sid = this.ensureSession(req, res);
    return this.cart.clear(sid);
  }

  /**
   * Read the session id cookie if it looks well-formed, otherwise issue a
   * fresh one. Anything that fails the UUID check is treated as missing —
   * this prevents an attacker from supplying a forged session id pointing
   * at another user's guest cart.
   */
  private ensureSession(req: Request, res: Response): string {
    const existing = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    if (typeof existing === 'string' && UUID_RE.test(existing)) return existing;
    const sid = randomUUID();
    res.cookie(SESSION_COOKIE, sid, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    return sid;
  }
}
