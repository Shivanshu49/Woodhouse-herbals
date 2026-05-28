import { Global, Module } from '@nestjs/common';
import { SecurityEventsService } from './security-events.service';
import { WebhookEventsService } from './webhook-events.service';

@Global()
@Module({
  providers: [SecurityEventsService, WebhookEventsService],
  exports: [SecurityEventsService, WebhookEventsService],
})
export class SecurityModule {}
