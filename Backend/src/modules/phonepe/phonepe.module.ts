import { Module } from '@nestjs/common';
import { PhonepeController } from './phonepe.controller';
import { PhonepeService } from './phonepe.service';
import { RefundsModule } from '../refunds/refunds.module';

// PhonepeModule → RefundsModule (one-directional: RefundsModule does NOT import
// PhonepeModule; PhonepeRefundClient is provided inside RefundsModule). This is
// what keeps the refund-callback wiring free of a circular module dependency.
@Module({
  imports: [RefundsModule],
  controllers: [PhonepeController],
  providers: [PhonepeService],
  exports: [PhonepeService],
})
export class PhonepeModule {}
