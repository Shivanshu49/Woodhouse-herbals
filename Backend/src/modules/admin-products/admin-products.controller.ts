import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AdminProductsService } from './admin-products.service';
import { ListAdminProductsDto } from './dto/list-admin-products.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { BulkProductsDto } from './dto/bulk-products.dto';
import { slugify } from './product-slug';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminAuditInterceptor } from '../../common/audit/admin-audit.interceptor';
import type { AuthenticatedUser } from '../../common/auth/auth-types';

const READ_ROLES = [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF];
const WRITE_ROLES = [UserRole.ADMIN, UserRole.MANAGER];

@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
export class AdminProductsController {
  constructor(private readonly products: AdminProductsService) {}

  @Roles(...READ_ROLES)
  @Get()
  list(@Query() dto: ListAdminProductsDto) {
    return this.products.adminList(dto);
  }

  // Declared BEFORE ':id' so Nest doesn't try to match "slug-check" as an id.
  @Roles(...READ_ROLES)
  @Get('slug-check')
  slugCheck(@Query('slug') slug: string, @Query('excludeId') excludeId?: string) {
    if (!slug) throw new BadRequestException('slug query param is required');
    return this.products.slugCheck(slugify(slug), excludeId);
  }

  @Roles(...READ_ROLES)
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.products.adminGetById(id);
  }

  @Roles(...WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthenticatedUser) {
    return this.products.create(dto, user.sub);
  }

  @Roles(...WRITE_ROLES)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Roles(...WRITE_ROLES)
  @Delete(':id')
  async softDelete(@Param('id') id: string) {
    await this.products.softDelete(id);
    return { ok: true };
  }

  @Roles(...WRITE_ROLES)
  @Post(':id/restore')
  async restore(@Param('id') id: string) {
    await this.products.restore(id);
    return { ok: true };
  }

  @Roles(...WRITE_ROLES)
  @Post('bulk')
  bulk(@Body() dto: BulkProductsDto) {
    return this.products.bulk(dto);
  }
}
