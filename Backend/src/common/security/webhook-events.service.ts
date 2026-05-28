import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

interface RecordInput {
  provider: string;
  eventType?: string;
  /** Raw request bytes — used to derive the idempotency key when none is given. */
  rawBody: string;
  /** Override the idempotency key (e.g. provider event id from the JSON body). */
  idempotencyKey?: string;
  signature?: string;
  payload: Prisma.InputJsonValue;
}

interface ClaimResult {
  /** Newly-created (never seen) or already-existed-but-not-yet-processed. */
  shouldProcess: boolean;
  eventId: string;
}

/**
 * Provider-webhook persistence + idempotency tracker.
 *
 * Stores every received webhook in `WebhookEvent` keyed by an
 * idempotency key (provider event id if available, otherwise SHA-256 of
 * the raw body). At-most-once processing is guaranteed: the unique
 * constraint on `idempotencyKey` makes a duplicate insert fail, and
 * `markProcessed` is the single place that flips `processed: true`.
 *
 * Use the pattern:
 *
 *   const claim = await webhooks.record({...});
 *   if (!claim.shouldProcess) return;            // already handled
 *   try {
 *     ...business logic...
 *     await webhooks.markProcessed(claim.eventId);
 *   } catch (err) {
 *     await webhooks.markFailed(claim.eventId, err);
 *     throw err;
 *   }
 */
@Injectable()
export class WebhookEventsService {
  private readonly logger = new Logger(WebhookEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordInput): Promise<ClaimResult> {
    const key =
      input.idempotencyKey ??
      createHash('sha256').update(`${input.provider}:${input.rawBody}`).digest('hex');

    try {
      const created = await this.prisma.webhookEvent.create({
        data: {
          provider: input.provider,
          eventType: input.eventType,
          idempotencyKey: key,
          signature: input.signature,
          payload: input.payload,
        },
        select: { id: true, processed: true },
      });
      return { shouldProcess: true, eventId: created.id };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Unique-constraint violation — this event was already recorded.
        // Re-process ONLY if the prior attempt didn't mark it processed.
        const existing = await this.prisma.webhookEvent.findUnique({
          where: { idempotencyKey: key },
          select: { id: true, processed: true },
        });
        if (!existing) throw err;
        this.logger.log(
          JSON.stringify({
            scope: 'webhook:duplicate',
            provider: input.provider,
            eventId: existing.id,
            processed: existing.processed,
          }),
        );
        return { shouldProcess: !existing.processed, eventId: existing.id };
      }
      throw err;
    }
  }

  async markProcessed(eventId: string): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { id: eventId },
      data: { processed: true, processedAt: new Date(), error: null },
    });
  }

  async markFailed(eventId: string, err: unknown): Promise<void> {
    const message = (err as Error)?.message ?? String(err);
    await this.prisma.webhookEvent.update({
      where: { id: eventId },
      data: { error: message.slice(0, 1000) },
    });
    this.logger.error(
      JSON.stringify({ scope: 'webhook:failed', eventId, err: message.slice(0, 200) }),
    );
  }
}
