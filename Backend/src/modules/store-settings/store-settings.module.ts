import { Global, Module } from '@nestjs/common';
import { StoreProfileService } from './store-profile.service';

@Global()
@Module({
  providers: [StoreProfileService],
  exports: [StoreProfileService],
})
export class StoreSettingsModule {}
