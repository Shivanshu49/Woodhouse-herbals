import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { redactSecrets } from './audit-redact';

export interface AuditEntry {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
}

export { redactSecrets };

@Injectable()
export class AuditService {
  private readonly logger = new Logger('AdminAudit');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Append-only. NEVER throws — a failed audit write must not fail the
   * mutation it records; it is logged for ops instead.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.adminAuditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          before: (redactSecrets(entry.before) ?? undefined) as Prisma.InputJsonValue | undefined,
          after: (redactSecrets(entry.after) ?? undefined) as Prisma.InputJsonValue | undefined,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent?.slice(0, 512) ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`audit write failed for ${entry.action}: ${(err as Error).message}`);
    }
  }
}
