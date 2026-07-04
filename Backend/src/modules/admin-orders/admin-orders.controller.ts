import { Body, Controller, Get, Param, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/auth-types';
import { AdminAuditInterceptor } from '../../common/audit/admin-audit.interceptor';
import { AdminOrdersService } from './admin-orders.service';
import { ListAdminOrdersDto } from './dto/list-admin-orders.dto';
import { AddOrderNoteDto } from './dto/add-order-note.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';

// Order management is ADMIN + MANAGER (spec §3); no STAFF admin-panel path.
const ORDER_ROLES = [UserRole.ADMIN, UserRole.MANAGER];

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Roles(...ORDER_ROLES)
  @Get()
  list(@Query() dto: ListAdminOrdersDto) {
    return this.orders.list(dto);
  }

  @Roles(...ORDER_ROLES)
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.orders.getById(id);
  }

  @Roles(...ORDER_ROLES)
  @Post(':id/notes')
  addNote(
    @Param('id') id: string,
    @Body() dto: AddOrderNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orders.addNote(id, dto, user.sub);
  }

  @Roles(...ORDER_ROLES)
  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orders.cancel(id, dto, user.sub);
  }
}
