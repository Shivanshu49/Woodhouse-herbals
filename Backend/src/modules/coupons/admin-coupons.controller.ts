import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAuditInterceptor } from '../../common/audit/admin-audit.interceptor';
import { AdminCouponsService } from './admin-coupons.service';
import { CreateCouponDto, SetCouponActiveDto, UpdateCouponDto } from './dto/coupon.dto';

// Coupons are a marketing surface: ADMIN + MANAGER can view; only ADMIN mutates
// (creating/editing a discount is a money decision).
const READ_ROLES = [UserRole.ADMIN, UserRole.MANAGER];
const WRITE_ROLES = [UserRole.ADMIN];

@Controller('admin/coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
export class AdminCouponsController {
  constructor(private readonly coupons: AdminCouponsService) {}

  @Roles(...READ_ROLES)
  @Get()
  list() {
    return this.coupons.list();
  }

  @Roles(...READ_ROLES)
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.coupons.getOne(id);
  }

  @Roles(...WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateCouponDto) {
    return this.coupons.create(dto);
  }

  @Roles(...WRITE_ROLES)
  @Patch(':id/active')
  setActive(@Param('id') id: string, @Body() dto: SetCouponActiveDto) {
    return this.coupons.setActive(id, dto.active);
  }

  @Roles(...WRITE_ROLES)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.coupons.update(id, dto);
  }
}
