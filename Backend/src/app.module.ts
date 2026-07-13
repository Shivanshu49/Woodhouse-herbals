import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './common/prisma/prisma.module';
import { SecurityModule } from './common/security/security.module';
import { AuditModule } from './common/audit/audit.module';
import { MailModule } from './common/mail/mail.module';
import { SmsModule } from './common/sms/sms.module';
import { HealthController } from './common/health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ConcernsModule } from './modules/concerns/concerns.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CustomersModule } from './modules/customers/customers.module';
import { RazorpayModule } from './modules/razorpay/razorpay.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SearchModule } from './modules/search/search.module';
import { HomepageModule } from './modules/homepage/homepage.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { AdminProductsModule } from './modules/admin-products/admin-products.module';
import { AdminOrdersModule } from './modules/admin-orders/admin-orders.module';
import { OrderEventsModule } from './modules/order-events/order-events.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { StoreSettingsModule } from './modules/store-settings/store-settings.module';
import { StorageModule } from './common/storage/storage.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { AdminCategoriesModule } from './modules/admin-categories/admin-categories.module';
import { AdminContentModule } from './modules/admin-content/admin-content.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    // Global baseline: 120 req / minute / IP. Per-endpoint limits override
    // this via @Throttle() — auth endpoints have much stricter quotas.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    SecurityModule,
    AuditModule,
    OrderEventsModule,
    MailModule,
    SmsModule,
    AuthModule,
    ProductsModule,
    CategoriesModule,
    ConcernsModule,
    CartModule,
    OrdersModule,
    CustomersModule,
    RazorpayModule,
    ReconciliationModule,
    InventoryModule,
    ReviewsModule,
    SearchModule,
    HomepageModule,
    CouponsModule,
    ShipmentsModule,
    UploadsModule,
    AdminProductsModule,
    AdminOrdersModule,
    RefundsModule,
    StoreSettingsModule,
    StorageModule,
    InvoicesModule,
    AdminUsersModule,
    AdminCategoriesModule,
    AdminContentModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
