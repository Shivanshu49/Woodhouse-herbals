import { Module } from '@nestjs/common';
import { AdminProductsController } from './admin-products.controller';
import { AdminProductsService } from './admin-products.service';

@Module({
  controllers: [AdminProductsController],
  providers: [AdminProductsService],
  exports: [AdminProductsService],
})
export class AdminProductsModule {}
