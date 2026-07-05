import { Module } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { InvoicesController } from './invoices.controller';

// Prisma / StoreProfile / ObjectStorage are @Global, so no imports are needed here.
// Exports InvoiceService so ShipmentsModule can auto-generate at the SHIPPED hook.
@Module({
  controllers: [InvoicesController],
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoicesModule {}
