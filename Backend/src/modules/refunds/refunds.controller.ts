import { Body, Controller, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/auth-types';
import { AdminAuditInterceptor } from '../../common/audit/admin-audit.interceptor';
import { RefundsService } from './refunds.service';
import { ManualRefundDto } from './dto/manual-refund.dto';
import { RefundOrderDto } from './dto/refund-order.dto';

/**
 * Refund endpoints — ADMIN-only (MANAGER is deliberately excluded; refunds move
 * real money), throttled, and audited. Shares the `admin/orders` prefix with
 * AdminOrdersController without path collision.
 */
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  /** Prepaid (PhonePe) refund — async: returns PENDING, settles via callback/recheck. */
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post(':id/refund')
  initiate(
    @Param('id') id: string,
    @Body() dto: RefundOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.refunds.initiate(id, dto, user.sub);
  }

  /** COD manual refund — one-step PROCESSED with a mandatory UTR. */
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post(':id/refund/manual')
  manual(
    @Param('id') id: string,
    @Body() dto: ManualRefundDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.refunds.manual(id, dto, user.sub);
  }

  /** Reconcile the order's active PhonePe refund against Check-Status. */
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post(':id/refund/recheck')
  recheck(@Param('id') id: string) {
    return this.refunds.recheck(id);
  }
}
