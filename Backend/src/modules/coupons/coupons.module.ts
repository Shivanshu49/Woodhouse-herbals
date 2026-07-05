import { Module } from '@nestjs/common';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { AdminCouponsController } from './admin-coupons.controller';
import { AdminCouponsService } from './admin-coupons.service';

@Module({
  controllers: [CouponsController, AdminCouponsController],
  providers: [CouponsService, AdminCouponsService],
  // CouponsService is consumed by OrdersModule (redeem inside the order txn).
  exports: [CouponsService],
})
export class CouponsModule {}
