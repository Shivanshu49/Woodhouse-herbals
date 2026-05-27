import { Injectable, Logger } from '@nestjs/common';
import type { AuthEventType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface RecordEventInput {
  userId?: string | null;
  type: AuthEventType;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Prisma.JsonObject;
}

/**
 * Append-only audit log for authentication and authorization events.
 *
 * All security-sensitive flows must call into this service so we have a
 * tamper-evident trail. Writes are best-effort and never throw — auditing
 * must not be able to break a user request — but failures are logged so the
 * SRE can alert on a broken pipeline.
 */
@Injectable()
export class SecurityEventsService {
  private readonly logger = new Logger(SecurityEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordEventInput): Promise<void> {
    const { userId, type, ip, userAgent, meta } = input;
    try {
      await this.prisma.authEvent.create({
        data: {
          userId: userId ?? undefined,
          type,
          ip: ip ?? undefined,
          userAgent: userAgent?.slice(0, 512) ?? undefined,
          meta,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to record auth event ${type}: ${(err as Error).message}`,
      );
    }
    // Structured stdout log too — picked up by CloudWatch / Loki / Datadog.
    this.logger.log(
      JSON.stringify({
        scope: 'security',
        type,
        userId: userId ?? null,
        ip: ip ?? null,
        userAgent: userAgent?.slice(0, 200) ?? null,
        meta: meta ?? null,
      }),
    );
  }

  /**
   * Count recent failures from a given IP — used by login throttling logic
   * in addition to the global rate limiter, so we can detect distributed
   * password spraying that stays under the per-IP throttle.
   */
  async recentFailuresForIp(ip: string, withinMinutes = 15): Promise<number> {
    const since = new Date(Date.now() - withinMinutes * 60 * 1000);
    return this.prisma.authEvent.count({
      where: { ip, type: 'LOGIN_FAILURE', createdAt: { gte: since } },
    });
  }
}
