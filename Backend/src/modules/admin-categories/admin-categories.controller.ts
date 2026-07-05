import {
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
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAuditInterceptor } from '../../common/audit/admin-audit.interceptor';
import { AdminCategoriesService } from './admin-categories.service';
import { CreateCategoryDto, ReorderCategoriesDto, UpdateCategoryDto } from './dto/category.dto';

// Catalogue WRITES are ADMIN + MANAGER; READS also include STAFF (so a STAFF who
// edits products can list categories to classify them — matches admin-products).
const ROLES = [UserRole.ADMIN, UserRole.MANAGER];
const READ_ROLES = [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF];

@Controller('admin/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
export class AdminCategoriesController {
  constructor(private readonly categories: AdminCategoriesService) {}

  @Roles(...READ_ROLES)
  @Get()
  list() {
    return this.categories.list();
  }

  // Declared BEFORE ':id' routes so "slug-check" / "reorder" aren't matched as ids.
  @Roles(...READ_ROLES)
  @Get('slug-check')
  slugCheck(@Query('slug') slug: string, @Query('excludeId') excludeId?: string) {
    return this.categories.slugCheck(slug ?? '', excludeId);
  }

  @Roles(...ROLES)
  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Roles(...ROLES)
  @Patch('reorder')
  reorder(@Body() dto: ReorderCategoriesDto) {
    return this.categories.reorder(dto);
  }

  @Roles(...ROLES)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Roles(...ROLES)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }
}
