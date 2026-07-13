import { Module } from '@nestjs/common';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';
import { RazorpayClient } from '../razorpay/razorpay.client';

/**
 * Refunds module. Prisma / Inventory / OrderEvents are @Global so they need no
 * import here. `RazorpayClient` is provided locally (not imported from the
 * razorpay module) so the razorpay module can import THIS module for the
 * webhook settle branch without a circular dependency — the same anti-cycle
 * shape the PhonePe era used. The client is stateless, so the second instance
 * is harmless. Exports RefundsService for that settle branch.
 */
@Module({
  controllers: [RefundsController],
  providers: [RefundsService, RazorpayClient],
  exports: [RefundsService],
})
export class RefundsModule {}
