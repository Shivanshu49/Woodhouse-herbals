import { Global, Module } from '@nestjs/common';
import { OrderEventsService } from './order-events.service';

// @Global so phonepe, shipments, and admin-orders can all record events without
// each importing this module (mirrors the @Global AuditModule precedent).
@Global()
@Module({
  providers: [OrderEventsService],
  exports: [OrderEventsService],
})
export class OrderEventsModule {}
