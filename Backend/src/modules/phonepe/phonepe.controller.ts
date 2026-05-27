import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UseGuards,
  Body,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { PhonepeService } from './phonepe.service';
import { InitiatePaymentDto } from './dto/phonepe.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/auth-types';
import { Public } from '../../common/decorators/public.decorator';

@Controller('phonepe')
export class PhonepeController {
  constructor(private readonly phonepe: PhonepeService) {}

  /**
   * Authenticated. Amount is derived from the order — never trusted from
   * the client. 10 inits / 10 min keeps card-testing rings off the endpoint.
   */
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 10 * 60 * 1000, limit: 10 } })
  @Post('initiate')
  initiate(@Body() dto: InitiatePaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.phonepe.initiate({ orderNumber: dto.orderNumber, userId: user.sub });
  }

  /**
   * Public webhook. Authenticated by the PhonePe X-VERIFY signature. The
   * raw request body is provided by an upstream express.raw() middleware
   * mounted in main.ts so the HMAC is computed over the same bytes that
   * PhonePe signed.
   */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Post('callback')
  @HttpCode(200)
  async callback(@Req() req: Request, @Headers('x-verify') signature?: string) {
    if (!signature) throw new BadRequestException('Missing signature');

    // express.raw() leaves req.body as a Buffer for this route.
    const raw =
      Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : typeof req.body === 'string'
          ? req.body
          : '';
    if (!raw) throw new BadRequestException('Missing body');

    const verified = this.phonepe.verifySignature(raw, signature);
    if (!verified) throw new BadRequestException('Signature mismatch');

    return this.phonepe.handleCallback(raw);
  }
}
