import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './common/prisma/prisma.module';
import { SecurityModule } from './common/security/security.module';
import { MailModule } from './common/mail/mail.module';
import { HealthController } from './common/health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ConcernsModule } from './modules/concerns/concerns.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CustomersModule } from './modules/customers/customers.module';
import { PhonepeModule } from './modules/phonepe/phonepe.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SearchModule } from './modules/search/search.module';
import { HomepageModule } from './modules/homepage/homepage.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    // Global baseline: 120 req / minute / IP. Per-endpoint limits override
    // this via @Throttle() — auth endpoints have much stricter quotas.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    SecurityModule,
    MailModule,
    AuthModule,
    ProductsModule,
    CategoriesModule,
    ConcernsModule,
    CartModule,
    OrdersModule,
    CustomersModule,
    PhonepeModule,
    InventoryModule,
    ReviewsModule,
    SearchModule,
    HomepageModule,
    CouponsModule,
    ShipmentsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
