import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../decorators/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  status() {
    // Liveness only. Deliberately no version/uptime — this endpoint is public
    // and unauthenticated, and those are a fingerprinting / deploy-recency leak.
    return {
      status: 'ok',
      service: 'woodhouse-api',
    };
  }

  @Get('ready')
  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', db: 'ok' };
    } catch {
      // Don't leak DB error detail to readiness probes / public health pages.
      return { status: 'degraded', db: 'unavailable' };
    }
  }
}
