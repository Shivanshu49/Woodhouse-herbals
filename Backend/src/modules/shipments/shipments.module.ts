import { Module } from '@nestjs/common';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';
import { InvoicesModule } from '../invoices/invoices.module';

// One-directional: ShipmentsModule → InvoicesModule (for the SHIPPED auto-gen
// hook). InvoicesModule does NOT import ShipmentsModule — no cycle.
@Module({
  imports: [InvoicesModule],
  controllers: [ShipmentsController],
  providers: [ShipmentsService],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
