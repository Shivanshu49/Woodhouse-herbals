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
}
