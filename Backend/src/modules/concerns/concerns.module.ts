import { Module } from '@nestjs/common';
import { ConcernsController } from './concerns.controller';
import { ConcernsService } from './concerns.service';

@Module({
  controllers: [ConcernsController],
  providers: [ConcernsService],
  exports: [ConcernsService],
})
export class ConcernsModule {}
