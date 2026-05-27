import { Module } from '@nestjs/common';
import { PhonepeController } from './phonepe.controller';
import { PhonepeService } from './phonepe.service';

@Module({
  controllers: [PhonepeController],
  providers: [PhonepeService],
  exports: [PhonepeService],
})
export class PhonepeModule {}
