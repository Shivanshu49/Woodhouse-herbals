import { Module } from '@nestjs/common';
import { RazorpayController } from './razorpay.controller';
import { RazorpayService } from './razorpay.service';
import { RazorpayClient } from './razorpay.client';

/**
 * Razorpay gateway module (Phase 3 shell: initiate + webhook verify/claim).
 * WebhookEventsService arrives via the @Global SecurityModule; settlement
 * wiring (RefundsModule import, order events) lands in Phase 4/5.
 */
@Module({
  controllers: [RazorpayController],
  providers: [RazorpayService, RazorpayClient],
  exports: [RazorpayService],
})
export class RazorpayModule {}
