import { Body, Controller, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminAuditInterceptor } from '../../common/audit/admin-audit.interceptor';
import type { AuthenticatedUser } from '../../common/auth/auth-types';

/**
 * Admin inventory endpoints. Phase C ships only the single manual-adjust used
 * by the products list's quick-stock action; Phase D (Inventory) builds its
 * richer UI on top of the same service.
 */
@Controller('admin/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  // Moving stock is a MANAGER+ capability, mirroring product writes. STAFF may
  // read the catalog but not mutate quantities.
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('adjust')
  adjust(@Body() dto: AdjustStockDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventory.adminAdjust({
      productId: dto.productId,
      delta: dto.delta,
      reason: dto.reason,
      note: dto.note ?? null,
      actorId: user.sub,
    });
  }
}
