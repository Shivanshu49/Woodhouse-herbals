import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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

/** Keys whose VALUES are secrets/live tokens and must never land in the audit log. */
const SECRET_KEY = /token|password|secret|inviteurl|reseturl|apikey|credential|x-verify/i;

/** Deep-redact secret-bearing values so the append-only audit log never persists
 *  a live token (e.g. a staff invite's password-reset URL) or credential. */
export function redactSecrets(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEY.test(k) ? '[redacted]' : redactSecrets(v, depth + 1);
  }
  return out;
}

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
