import { Module } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { RazorpayModule } from '../razorpay/razorpay.module';
import { RefundsModule } from '../refunds/refunds.module';
import { RazorpayClient } from '../razorpay/razorpay.client';

/**
 * Reconciliation cron. Imports RazorpayModule (RazorpaySettlementService —
 * the settle door + abandonPayment) and RefundsModule (RefundsService —
 * recoverPendingRefund). RazorpayClient is provided locally for provider
 * READS only (stateless, so a second instance is harmless);
 * WebhookEventsService arrives via the @Global SecurityModule.
 *
 * ScheduleModule.forRoot() is registered once in AppModule.
 */
@Module({
  imports: [RazorpayModule, RefundsModule],
  providers: [ReconciliationService, RazorpayClient],
})
export class ReconciliationModule {}
