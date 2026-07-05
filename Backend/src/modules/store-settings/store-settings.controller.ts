import { Body, Controller, Get, Patch, UseGuards, UseInterceptors } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/auth-types';
import { AdminAuditInterceptor } from '../../common/audit/admin-audit.interceptor';
import { StoreSettingsAdminService } from './store-settings-admin.service';
import { UpdateStoreProfileDto } from './dto/update-store-profile.dto';

// Settings are ADMIN-only (MANAGER excluded per the UserRole comment).
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
export class StoreSettingsController {
  constructor(private readonly settings: StoreSettingsAdminService) {}

  @Roles(UserRole.ADMIN)
  @Get('store')
  getStore() {
    return this.settings.getProfile();
  }

  @Roles(UserRole.ADMIN)
  @Patch('store')
  updateStore(@Body() dto: UpdateStoreProfileDto, @CurrentUser() user: AuthenticatedUser) {
    return this.settings.updateProfile(dto, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Get('integrations')
  integrations() {
    return this.settings.integrations();
  }
}
