import { Module } from '@nestjs/common';
import { InvoiceService } from './invoice.service';

// Controller is added in Phase D (Task 10). Prisma / StoreProfile / ObjectStorage
// are @Global, so no imports are needed here.
@Module({
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoicesModule {}
