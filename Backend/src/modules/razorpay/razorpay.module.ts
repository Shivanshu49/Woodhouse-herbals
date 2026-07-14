import { Module } from '@nestjs/common';
import { RazorpayController } from './razorpay.controller';
import { RazorpayService } from './razorpay.service';
import { RazorpayClient } from './razorpay.client';
import { RazorpaySettlementService } from './razorpay-settlement.service';
import { RefundsModule } from '../refunds/refunds.module';

/**
 * Razorpay gateway module. One-directional import of RefundsModule (the
 * same anti-cycle shape used before) so refund webhooks settle through
 * RefundsService — the single refund money path. WebhookEventsService and
 * OrderEventsService arrive via @Global modules.
 */
@Module({
  imports: [RefundsModule],
  controllers: [RazorpayController],
  providers: [RazorpayService, RazorpayClient, RazorpaySettlementService],
  exports: [RazorpayService, RazorpaySettlementService],
})
export class RazorpayModule {}
