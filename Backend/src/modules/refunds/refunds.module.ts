import { Module } from '@nestjs/common';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';
import { PhonepeRefundClient } from '../phonepe/phonepe-refund.client';

/**
 * Refunds module. Prisma / Inventory / OrderEvents are @Global so they need no
 * import here. `PhonepeRefundClient` is provided locally (not imported from the
 * phonepe module) so the phonepe module can later import THIS module for the
 * callback settle branch without a circular dependency. Exports RefundsService
 * for that callback branch.
 */
@Module({
  controllers: [RefundsController],
  providers: [RefundsService, PhonepeRefundClient],
  exports: [RefundsService],
})
export class RefundsModule {}
