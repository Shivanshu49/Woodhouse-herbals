import { Global, Module } from '@nestjs/common';
import { StoreProfileService } from './store-profile.service';
import { StoreSettingsAdminService } from './store-settings-admin.service';
import { StoreSettingsController } from './store-settings.controller';

@Global()
@Module({
  controllers: [StoreSettingsController],
  providers: [StoreProfileService, StoreSettingsAdminService],
  exports: [StoreProfileService],
})
export class StoreSettingsModule {}
