import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { env } from '../../common/config/env';
import { RazorpaySettlementService } from '../razorpay/razorpay-settlement.service';
import { RefundsService } from '../refunds/refunds.service';
import { RazorpayClient } from '../razorpay/razorpay.client';
import { WebhookEventsService } from '../../common/security/webhook-events.service';
import { parseWebhookEnvelope } from '../razorpay/razorpay-webhook-router';
import { decidePaymentSweep, type PaymentAttempt } from './reconcile-decisions';

const BATCH_CAP = 50;

/**
 * Reconciliation cron (plan §1.4) — the backstop for lost webhooks and the
 * sole owner of terminal abandonment. Every money action is delegated to the
 * SINGLE settlement door (RazorpaySettlementService) or the SINGLE refund
 * recovery routine (RefundsService.recoverPendingRefund) — this service
 * triages and drives, it NEVER settles money itself. Guard drift starts the
 * day a sweep grows its own settle path; there is none here.
 *
 * ⚠ SINGLE-INSTANCE ASSUMPTION. @nestjs/schedule has no distributed locking,
 * so N app replicas = N concurrent firings. Every action this service takes
 * is idempotent (CAS-gated settles, CAS-gated abandonment, at-most-once claim
 * re-drive), so correctness holds under concurrency — but if this app is ever
 * scaled past ONE replica, wrap each sweep body in a pg_try_advisory_lock to
 * avoid wasted duplicate provider calls. Not built now (staging = 1 replica).
 *
 * Dead-man: each sweep stamps `reconcile:<name>:last_completed_at` ONLY on a
 * clean finish (the stamp is the LAST statement, after the work) — a crashed
 * sweep never advances it. NOTE (CP5 review): this is a pure LIVENESS signal —
 * the per-row try/catch below keeps it fresh even when every row fails, so it
 * proves "the sweep fired", NOT "the sweep made progress". The PRE-LAUNCH
 * alert must therefore (a) max over ALL THREE keys (payments/refunds/redrive),
 * and (b) pair liveness with a per-domain BACKLOG signal — oldest INITIATED
 * payment age (exists), oldest PENDING GATEWAY refund age, and oldest
 * processed=false razorpay WebhookEvent age. Wholesale row failures are also
 * loud (per-row logger.error), so log/error-rate monitoring is a parallel net.
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  // Money WRITES go through `settlement` / `refunds` (the single doors);
  // `client` is used only for provider READS and `webhooks` only for claim
  // bookkeeping — neither settles money.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RazorpaySettlementService) private readonly settlement: RazorpaySettlementService,
    @Inject(RefundsService) private readonly refunds: RefundsService,
    @Inject(RazorpayClient) private readonly client: RazorpayClient,
    @Inject(WebhookEventsService) private readonly webhooks: WebhookEventsService,
  ) {}

  // ── payments sweep ──────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcilePayments(): Promise<void> {
    await this.fire('payments', () => this.sweepPayments());
  }

  async sweepPayments(): Promise<void> {
    const minAgeCutoff = new Date(Date.now() - env.RECONCILE_PAYMENT_MIN_AGE_MIN * 60_000);
    const rows = await this.prisma.payment.findMany({
      where: {
        provider: 'razorpay',
        status: 'INITIATED',
        providerTxnId: { not: null },
        createdAt: { lt: minAgeCutoff },
        // Exclude orders already flagged with an amount-mismatch anomaly: that
        // is the terminal for a held payment (persisted once, awaiting manual
        // resolution). Excluding them here means no re-fetch loop AND no
        // permanently-pinned batch-cap slot (CP5 review).
        order: { is: { events: { none: { type: 'payment_amount_mismatch' } } } },
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH_CAP,
      select: {
        id: true,
        providerTxnId: true,
        amountMinor: true,
        createdAt: true,
        orderId: true,
        order: {
          select: { number: true, items: { select: { productId: true, quantity: true } } },
        },
      },
    });
    if (rows.length === BATCH_CAP) {
      this.logger.warn(
        JSON.stringify({ scope: 'razorpay:reconcile:payments:batch_capped', cap: BATCH_CAP }),
      );
    }

    for (const row of rows) {
      try {
        await this.reconcileOnePayment(row);
      } catch (err) {
        // One bad row must not abort the batch; the next sweep retries it.
        this.logger.error(
          JSON.stringify({
            scope: 'razorpay:reconcile:payments:row_failed',
            paymentId: row.id,
            err: String(err).slice(0, 200),
          }),
        );
      }
    }
  }

  private async reconcileOnePayment(row: {
    id: string;
    providerTxnId: string | null;
    amountMinor: number;
    createdAt: Date;
    orderId: string;
    order: { number: string; items: { productId: string; quantity: number }[] } | null;
  }): Promise<void> {
    if (!row.providerTxnId || !row.order) return;

    let attempts: PaymentAttempt[];
    try {
      attempts = await this.client.fetchOrderPayments(row.providerTxnId);
    } catch {
      // Provider unreachable — never guess; the next sweep retries.
      this.logger.warn(
        JSON.stringify({ scope: 'razorpay:reconcile:payments:fetch_failed', paymentId: row.id }),
      );
      return;
    }

    const decision = decidePaymentSweep({
      paymentAgeMin: (Date.now() - row.createdAt.getTime()) / 60_000,
      minAgeMin: env.RECONCILE_PAYMENT_MIN_AGE_MIN,
      abandonTtlHours: env.PAYMENT_ABANDON_TTL_HOURS,
      expectedAmountMinor: row.amountMinor,
      expectedRzpOrderId: row.providerTxnId,
      attempts,
    });

    switch (decision.action) {
      case 'settle-success':
      case 'anomaly-hold': {
        // Hand the captured entity to the ONE door — it re-applies the full
        // guard and either settles (matched) or persists the hold (mismatch,
        // flagging the order so the query above excludes it next sweep). The
        // sweep NEVER writes SUCCESS itself.
        const captured = attempts.find((a) => a.id === decision.providerPaymentId);
        if (captured) await this.settlement.processPaymentEntity(captured);
        return;
      }
      case 'abandon':
        await this.settlement.abandonPayment({
          paymentId: row.id,
          orderId: row.orderId,
          orderNumber: row.order.number,
          items: row.order.items,
        });
        return;
      case 'authorized-stuck':
      case 'wait':
      default:
        // No money action. authorized-stuck self-resolves (auto-capture voids
        // an uncaptured authorize); wait defers to the next sweep.
        return;
    }
  }

  // ── refunds sweep ───────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcileRefunds(): Promise<void> {
    await this.fire('refunds', () => this.sweepRefunds());
  }

  async sweepRefunds(): Promise<void> {
    const cutoff = new Date(Date.now() - env.REFUND_CONCLUDE_MIN_AGE_MIN * 60_000);
    const rows = await this.prisma.refund.findMany({
      where: { method: 'GATEWAY', status: 'PENDING', createdAt: { lt: cutoff } },
      orderBy: { createdAt: 'asc' },
      take: BATCH_CAP,
      select: {
        id: true,
        merchantRefundId: true,
        providerRefundId: true,
        createdAt: true,
        amountMinor: true,
        order: { select: { number: true } },
        payment: { select: { providerPaymentId: true } },
      },
    });

    for (const row of rows) {
      if (!row.merchantRefundId) continue;
      try {
        await this.refunds.recoverPendingRefund({
          id: row.id,
          merchantRefundId: row.merchantRefundId,
          providerRefundId: row.providerRefundId,
          createdAt: row.createdAt,
          amountMinor: row.amountMinor,
          providerPaymentId: row.payment?.providerPaymentId ?? null,
          orderNumber: row.order.number,
        });
      } catch (err) {
        this.logger.error(
          JSON.stringify({
            scope: 'razorpay:reconcile:refunds:row_failed',
            refundId: row.id,
            err: String(err).slice(0, 200),
          }),
        );
      }
    }
  }

  // ── unprocessed-claims re-drive (Phase 4 finding #5) ────────────────────

  @Cron(CronExpression.EVERY_5_MINUTES)
  async redriveUnprocessedClaims(): Promise<void> {
    await this.fire('redrive', () => this.sweepUnprocessedClaims());
  }

  /**
   * Replay razorpay WebhookEvent claims left processed=false > the min-age
   * through the SAME settlement door, then markProcessed. Covers the one gap
   * the INITIATED-only payments sweep cannot: a crash/tx-timeout in the
   * captured_after_abandon recovery leaves a FAILED payment the payments
   * sweep never revisits, but its claim is still processed=false here.
   * Idempotent: every door action is CAS-gated, so replaying a claim a
   * concurrent webhook is settling right now is a safe no-op.
   */
  async sweepUnprocessedClaims(): Promise<void> {
    const cutoff = new Date(Date.now() - env.RECONCILE_PAYMENT_MIN_AGE_MIN * 60_000);
    const rows = await this.prisma.webhookEvent.findMany({
      where: { provider: 'razorpay', processed: false, createdAt: { lt: cutoff } },
      orderBy: { createdAt: 'asc' },
      take: BATCH_CAP,
      select: { id: true, payload: true },
    });

    for (const row of rows) {
      try {
        await this.settlement.processWebhook(parseWebhookEnvelope(row.payload));
        await this.webhooks.markProcessed(row.id);
      } catch (err) {
        // Leave processed=false — the next re-drive retries. Do not markFailed
        // here (it would overwrite the original error context uselessly).
        this.logger.error(
          JSON.stringify({
            scope: 'razorpay:reconcile:redrive:failed',
            eventId: row.id,
            err: String(err).slice(0, 200),
          }),
        );
      }
    }
  }

  // ── dead-man ────────────────────────────────────────────────────────────

  /**
   * Run a sweep from a @Cron entry point: stamp the dead-man ONLY on a clean
   * finish (the stamp is AFTER the body, so a throw skips it — a dead-man that
   * never lies), and NEVER let a sweep failure escape. An unhandled rejection
   * out of a @Cron method would, under Node's default policy, risk the whole
   * process; a broken sweep must degrade to a logged, un-stamped no-op — never
   * take the API down. The skipped stamp is what the liveness alert detects.
   */
  private async fire(name: string, body: () => Promise<void>): Promise<void> {
    try {
      await body();
      await this.stampCompleted(name);
    } catch (err) {
      this.logger.error(
        JSON.stringify({
          scope: 'razorpay:reconcile:sweep_crashed',
          sweep: name,
          err: String(err).slice(0, 200),
        }),
      );
    }
  }

  private async stampCompleted(name: string): Promise<void> {
    const key = `reconcile:${name}:last_completed_at`;
    const value = new Date().toISOString();
    await this.prisma.storeSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
}
