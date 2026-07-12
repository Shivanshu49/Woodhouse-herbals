import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrderEventsService } from '../order-events/order-events.service';
import { OrderEventType } from '../order-events/order-event-types';
import { RefundsService } from '../refunds/refunds.service';
import { env } from '../../common/config/env';
import { RazorpayClient } from './razorpay.client';
import {
  decidePaymentEntityAction,
  mapRazorpayRefundState,
  type RazorpayPaymentEntity,
} from './razorpay-states';
import { verifyCheckoutSignature } from './razorpay-signing';
import type { ParsedWebhook, RazorpayRefundEntity } from './razorpay-webhook-router';

/**
 * THE single settlement door (plan §1.1[5], §1.3; CP3 attack #1).
 *
 * Every money transition triggered by Razorpay state — webhook, the client
 * verify fast-path, and (Phase 6) the reconciliation sweeps — flows through
 * processPaymentEntity / processRefundEntity in THIS file. No other code may
 * write Payment.status = SUCCESS from provider input. The full settle guard
 * (status 'captured' AND amount === Payment.amountMinor AND order_id ===
 * providerTxnId) lives in decidePaymentEntityAction and is therefore
 * structurally identical for every caller.
 *
 * Anomalies that denote captured customer money in an unexpected state are
 * PERSISTED as order-events, never log-only (plan Global Constraints):
 * `paid_on_non_pending`, `captured_after_abandon`, `payment_amount_mismatch`,
 * `refund_settled_after_conclude`.
 */
@Injectable()
export class RazorpaySettlementService {
  private readonly logger = new Logger(RazorpaySettlementService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OrderEventsService) private readonly events: OrderEventsService,
    @Inject(RefundsService) private readonly refunds: RefundsService,
    @Inject(RazorpayClient) private readonly client: RazorpayClient,
  ) {}

  /** Route one parsed webhook to the right entity processor. */
  async processWebhook(parsed: ParsedWebhook): Promise<string> {
    if (parsed.kind === 'payment') return this.processPaymentEntity(parsed.payment);
    if (parsed.kind === 'refund') return this.processRefundEntity(parsed.refund);
    this.logger.log(JSON.stringify({ scope: 'razorpay:webhook:ignored', event: parsed.event }));
    return 'ignored-unknown-event';
  }

  // ── payments ──────────────────────────────────────────────────────────────

  async processPaymentEntity(entity: RazorpayPaymentEntity): Promise<string> {
    const payment = await this.prisma.payment.findUnique({
      where: { providerTxnId: entity.order_id },
      select: {
        id: true,
        orderId: true,
        amountMinor: true,
        providerTxnId: true,
        status: true,
        order: { select: { id: true, cartSessionId: true } },
      },
    });
    if (!payment) {
      // Not ours (other env / stale order). Ack + log — never make the
      // provider retry forever over a row we don't have.
      this.logger.warn(
        JSON.stringify({ scope: 'razorpay:settle:unknown_payment', rzpOrderId: entity.order_id }),
      );
      return 'unknown-payment';
    }

    const action = decidePaymentEntityAction(entity, {
      amountMinor: payment.amountMinor,
      rzpOrderId: payment.providerTxnId!,
    });

    switch (action.action) {
      case 'settle-success':
        return this.settleSuccess(payment, entity);
      case 'amount-mismatch-hold':
        return this.holdAmountMismatch(payment, entity);
      case 'annotate-failed':
        // Gated on INITIATED: a late failed-attempt webhook must never
        // clobber a SUCCESS row's capture evidence — and this path NEVER
        // writes providerPaymentId (that is the captured-settle's exclusive
        // right). CP3 attack #5.
        await this.prisma.payment.updateMany({
          where: { id: payment.id, status: 'INITIATED' },
          data: { rawResponse: entity as unknown as Prisma.InputJsonValue },
        });
        return 'annotated-failed';
      default:
        this.logger.log(
          JSON.stringify({ scope: 'razorpay:settle:no_action', action: action.action }),
        );
        return action.action;
    }
  }

  /**
   * The idempotent success settle. The payment CAS (INITIATED→SUCCESS) is
   * the exactly-once gate; the order CAS (PENDING→PAID) never resurrects an
   * order that already left PENDING. Ports PhonePe markSuccess semantics
   * with paid_on_non_pending upgraded to a persisted event.
   */
  private async settleSuccess(
    payment: {
      id: string;
      orderId: string;
      order: { id: string; cartSessionId: string | null };
    },
    entity: RazorpayPaymentEntity,
  ): Promise<string> {
    let claimed = 0;
    await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.payment.updateMany({
          where: { id: payment.id, status: 'INITIATED' },
          data: {
            status: 'SUCCESS',
            providerPaymentId: entity.id,
            rawResponse: entity as unknown as Prisma.InputJsonValue,
          },
        });
        claimed = updated.count;
        if (updated.count !== 1) return; // recovery path runs outside this tx

        const advanced = await tx.order.updateMany({
          where: { id: payment.orderId, status: OrderStatus.PENDING },
          data: { status: OrderStatus.PAID },
        });
        if (advanced.count !== 1) {
          // Money captured but the order already left PENDING — PERSISTED
          // anomaly (two payable rzp orders make this reachable), never a
          // log line. Payment stays SUCCESS; never throw (provider retries).
          await this.events.record(
            {
              orderId: payment.orderId,
              type: 'paid_on_non_pending',
              note: 'Payment captured but the order had already left PENDING — needs manual review/refund.',
              meta: { providerPaymentId: entity.id, amountMinor: entity.amount },
            },
            tx,
          );
          return;
        }

        await this.events.record(
          {
            orderId: payment.orderId,
            type: OrderEventType.StatusChanged,
            fromStatus: OrderStatus.PENDING,
            toStatus: OrderStatus.PAID,
            meta: { via: 'razorpay', providerPaymentId: entity.id },
          },
          tx,
        );

        if (payment.order.cartSessionId) {
          const cart = await tx.cart.findUnique({
            where: { sessionId: payment.order.cartSessionId },
          });
          if (cart) await tx.cartLine.deleteMany({ where: { cartId: cart.id } });
        }
      },
      { timeout: env.ADMIN_WRITE_TX_TIMEOUT_MS },
    );

    if (claimed === 1) {
      this.logger.log(
        JSON.stringify({ scope: 'razorpay:settle:success', orderId: payment.orderId }),
      );
      return 'settled';
    }
    return this.recoverNonInitiated(payment.id, payment.orderId, entity);
  }

  /**
   * The captured-settle CAS found the row NOT in INITIATED (CP3 attack #3).
   * NEVER a silent no-op (the PhonePe `// raced — leave alone` is correct
   * only between success paths): re-read and distinguish
   *  - FAILED (cron abandonment or initiate supersede) → dedicated CAS
   *    FAILED→SUCCESS + persisted `captured_after_abandon` + best-effort
   *    order advance (a superseded-row capture on a still-PENDING order is
   *    a legitimate payment; an abandoned order stays CANCELLED — already
   *    restocked, and restockApplies skips CANCELLED so a later refund can
   *    never double-restock);
   *  - SUCCESS/REFUND_PENDING/REFUNDED → duplicate delivery, no-op.
   */
  private async recoverNonInitiated(
    paymentId: string,
    orderId: string,
    entity: RazorpayPaymentEntity,
  ): Promise<string> {
    const row = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { status: true },
    });
    if (!row) return 'vanished';
    if (row.status !== 'FAILED') return 'already-terminal';

    let recovered = 0;
    let orderAdvanced = 0;
    await this.prisma.$transaction(
      async (tx) => {
        const rec = await tx.payment.updateMany({
          where: { id: paymentId, status: 'FAILED' },
          data: {
            status: 'SUCCESS',
            providerPaymentId: entity.id,
            rawResponse: entity as unknown as Prisma.InputJsonValue,
          },
        });
        recovered = rec.count;
        if (rec.count !== 1) return; // raced with another recovery — no-op

        // A capture on a SUPERSEDED row while the order is still PENDING is
        // a legitimate payment — advance it. An ABANDONED order (CANCELLED)
        // is deliberately NOT resurrected; the persisted anomaly routes the
        // admin to the refund path (restock stays exactly-once).
        const adv = await tx.order.updateMany({
          where: { id: orderId, status: OrderStatus.PENDING },
          data: { status: OrderStatus.PAID },
        });
        orderAdvanced = adv.count;

        await this.events.record(
          {
            orderId,
            type: 'captured_after_abandon',
            note:
              adv.count === 1
                ? 'Late capture recovered on a superseded payment attempt — order advanced to PAID.'
                : 'Money captured AFTER this order was abandoned/cancelled — payment recovered to SUCCESS; refund it via the standard refund path.',
            meta: {
              paymentId,
              providerPaymentId: entity.id,
              amountMinor: entity.amount,
              orderAdvanced: adv.count === 1,
            },
          },
          tx,
        );
        if (adv.count === 1) {
          await this.events.record(
            {
              orderId,
              type: OrderEventType.StatusChanged,
              fromStatus: OrderStatus.PENDING,
              toStatus: OrderStatus.PAID,
              meta: { via: 'razorpay', providerPaymentId: entity.id, recovered: true },
            },
            tx,
          );
        }
      },
      { timeout: env.ADMIN_WRITE_TX_TIMEOUT_MS },
    );
    if (recovered !== 1) return 'already-terminal';
    this.logger.error(
      JSON.stringify({
        scope: 'razorpay:settle:captured_after_abandon',
        orderId,
        orderAdvanced: orderAdvanced === 1,
      }),
    );
    return orderAdvanced === 1 ? 'captured-after-supersede-paid' : 'captured-after-abandon';
  }

  /** Amount-mismatch anomaly hold (plan §1.3): persist once, settle nothing. */
  private async holdAmountMismatch(
    payment: { id: string; orderId: string; amountMinor: number },
    entity: RazorpayPaymentEntity,
  ): Promise<string> {
    const existing = await this.prisma.orderEvent.findFirst({
      where: { orderId: payment.orderId, type: 'payment_amount_mismatch' },
      select: { id: true },
    });
    if (!existing) {
      await this.events.record({
        orderId: payment.orderId,
        type: 'payment_amount_mismatch',
        note: 'Captured amount does not match the order — payment held INITIATED for manual review.',
        meta: {
          paymentId: payment.id,
          expectedMinor: payment.amountMinor,
          capturedMinor: entity.amount,
          providerPaymentId: entity.id,
        },
      });
    }
    this.logger.error(
      JSON.stringify({
        scope: 'razorpay:settle:amount_mismatch',
        paymentId: payment.id,
        expected: payment.amountMinor,
        got: entity.amount,
      }),
    );
    return 'amount-mismatch-held';
  }

  // ── refunds ───────────────────────────────────────────────────────────────

  async processRefundEntity(refund: RazorpayRefundEntity): Promise<string> {
    const or: Prisma.RefundWhereInput[] = [{ providerRefundId: refund.id }];
    if (refund.receipt) or.push({ merchantRefundId: refund.receipt });
    const row = await this.prisma.refund.findFirst({
      where: { OR: or },
      select: { id: true, orderId: true, status: true },
    });
    if (!row) {
      this.logger.warn(
        JSON.stringify({ scope: 'razorpay:settle:unknown_refund', rzpRefundId: refund.id }),
      );
      return 'unknown-refund';
    }

    const mapped = mapRazorpayRefundState(refund.status);

    // Money-moved-after-conclude tripwire (plan §3 item 4): a terminal
    // provider SUCCESS for a refund we already concluded FAILED is a books
    // contradiction — persist it; never silently no-op.
    if (mapped === 'PROCESSED' && row.status === 'FAILED') {
      await this.events.record({
        orderId: row.orderId,
        type: 'refund_settled_after_conclude',
        note: 'Provider reports this refund PROCESSED but it was concluded FAILED — books contradiction, reconcile manually.',
        meta: { refundId: row.id, providerRefundId: refund.id, amountMinor: refund.amount },
      });
      this.logger.error(
        JSON.stringify({ scope: 'razorpay:settle:refund_after_conclude', refundId: row.id }),
      );
      return 'refund-settled-after-conclude';
    }

    await this.refunds.settle(row.id, mapped, refund.id, refund);
    return `refund-${mapped.toLowerCase()}`;
  }

  // ── client verify fast-path (plan §1.1[4]) ───────────────────────────────

  /**
   * Checkout-callback verification: the signature proves Razorpay generated
   * the tuple, NOT that money is captured — always re-fetch from the API
   * (authority #1) and settle through the SAME door as the webhook.
   */
  async verifyFastPath(input: {
    orderNumber: string;
    userId?: string;
    sessionId?: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Promise<{ orderStatus: OrderStatus; outcome: string }> {
    const order = await this.prisma.order.findUnique({
      where: { number: input.orderNumber },
      select: { id: true, userId: true, cartSessionId: true, status: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    const ownedByUser = Boolean(input.userId && order.userId === input.userId);
    const ownedBySession = Boolean(input.sessionId && order.cartSessionId === input.sessionId);
    if (!ownedByUser && !ownedBySession) throw new NotFoundException('Order not found');

    if (
      !env.RAZORPAY_KEY_SECRET ||
      !verifyCheckoutSignature(
        input.razorpayOrderId,
        input.razorpayPaymentId,
        input.razorpaySignature,
        env.RAZORPAY_KEY_SECRET,
      )
    ) {
      throw new BadRequestException('Signature mismatch');
    }

    // The tuple must belong to THIS order's payment row.
    const payment = await this.prisma.payment.findUnique({
      where: { providerTxnId: input.razorpayOrderId },
      select: { orderId: true },
    });
    if (!payment || payment.orderId !== order.id) {
      throw new BadRequestException('Payment does not belong to this order');
    }

    let outcome: string;
    try {
      const entity = await this.client.fetchPayment(input.razorpayPaymentId);
      outcome = await this.processPaymentEntity(entity);
    } catch {
      // API unreachable: the hint stays a hint — leave INITIATED, the
      // webhook/cron settle later. Respond honestly as processing.
      outcome = 'provider-unreachable';
    }

    const after = await this.prisma.order.findUnique({
      where: { id: order.id },
      select: { status: true },
    });
    return { orderStatus: after?.status ?? order.status, outcome };
  }
}
