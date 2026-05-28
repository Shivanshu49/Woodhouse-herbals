import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../decorators/public.decorator';
import { APP_VERSION } from '../config/env';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  status() {
    return {
      status: 'ok',
      service: 'woodhouse-api',
      version: APP_VERSION,
      uptimeSeconds: Math.round(process.uptime()),
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
