import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InventoryReason, OrderStatus, Prisma, RefundDisposition } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrderEventsService } from '../order-events/order-events.service';
import { OrderEventType } from '../order-events/order-event-types';
import { InventoryService } from '../inventory/inventory.service';
import { env } from '../../common/config/env';
// Type-only: the legacy settleFromProvider stays compiling until the PhonePe
// module is deleted in Phase 7. The VALUE dependency is gone — this service
// talks to Razorpay.
import type { PhonepeRefundResult } from '../phonepe/phonepe-refund.client';
import { RazorpayClient, type RefundCreateResult } from '../razorpay/razorpay.client';
import { mapRazorpayRefundState } from '../razorpay/razorpay-states';
import { decideRefundSweep, type RefundSweepInput } from '../reconciliation/reconcile-decisions';
import {
  assertRefundable,
  deriveMerchantRefundId,
  mapRefundState,
  shouldRestock,
} from './refund-transitions';
import { ManualRefundDto } from './dto/manual-refund.dto';
import { RefundOrderDto } from './dto/refund-order.dto';

/**
 * Full-order refunds. Money never moves without a persisted, audited `Refund`
 * row; an order never shows REFUNDED unless the money settled. The COD manual
 * path (this file, Task 5) settles in one transaction; the prepaid PhonePe path
 * (Tasks 6-7) persists first, then reconciles via callback/recheck.
 */
@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  // Explicit tokens throughout: the tsx-based integration harness boots the
  // full module graph without design:paramtypes (see razorpay.controller.ts).
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OrderEventsService) private readonly events: OrderEventsService,
    @Inject(InventoryService) private readonly inventory: InventoryService,
    @Inject(RazorpayClient) private readonly razorpay: RazorpayClient,
  ) {}

  /**
   * Whether THIS refund attempt should credit stock. One physical return restocks
   * exactly once, regardless of money attempts:
   *  - only a restocking disposition (RETURNED) ever credits stock;
   *  - a CANCELLED order was already restocked by the pre-shipment cancel
   *    (reason ORDER_CANCELLED) — refunding it must not credit the goods twice;
   *  - a prior refund on this order that already restocked (a RETURNED refund, incl.
   *    a FAILED one whose restock is never reversed) means the goods are already back,
   *    so a retry re-attempts only the money.
   */
  private restockApplies(
    status: OrderStatus,
    disposition: RefundDisposition,
    priorDispositions: RefundDisposition[],
  ): boolean {
    if (!shouldRestock(disposition)) return false;
    if (status === OrderStatus.CANCELLED) return false;
    if (priorDispositions.some((d) => d === RefundDisposition.RETURNED)) return false;
    return true;
  }

  /**
   * COD manual refund — one transaction, immediately PROCESSED. The admin has
   * already transferred the money out of band; the mandatory `utrReference`
   * proves it. Guards: the order must be in a refundable state AND be COD (no
   * SUCCESS PhonePe payment — an online-paid order must use the PhonePe path).
   * The partial unique index (one non-FAILED refund per order) makes a
   * double-submit a 409 rather than a double payout.
   */
  async manual(orderId: string, dto: ManualRefundDto, actorId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        number: true,
        status: true,
        totalMinor: true,
        items: { select: { productId: true, quantity: true } },
        payments: { where: { status: 'SUCCESS' }, select: { id: true } },
        refunds: { select: { disposition: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    assertRefundable(order.status);
    if (order.payments.length) {
      throw new ConflictException(
        'This order was paid online — use the PhonePe refund, not the manual (COD) refund.',
      );
    }
    const restock = this.restockApplies(
      order.status,
      dto.disposition,
      order.refunds.map((r) => r.disposition),
    );

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const refund = await tx.refund.create({
            data: {
              orderId,
              amountMinor: order.totalMinor,
              method: 'MANUAL',
              disposition: dto.disposition,
              utrReference: dto.utrReference,
              status: 'PROCESSED',
              reason: dto.reason,
              actorId,
            },
            select: { id: true, status: true },
          });

          if (restock) {
            for (const it of order.items) {
              await this.inventory.adjust({
                productId: it.productId,
                delta: it.quantity,
                reason: InventoryReason.RETURNED,
                actorId,
                reference: order.number,
                tx,
              });
            }
          }

          await tx.order.update({
            where: { id: orderId },
            data: { status: OrderStatus.REFUNDED },
          });

          await this.events.record(
            {
              orderId,
              type: OrderEventType.RefundIssued,
              actorId,
              note: `Manual COD refund (UTR ${dto.utrReference})`,
              meta: {
                method: 'MANUAL',
                disposition: dto.disposition,
                amountMinor: order.totalMinor,
                refundId: refund.id,
              },
            },
            tx,
          );
          await this.events.record(
            {
              orderId,
              type: 'refund_settled',
              actorId,
              toStatus: OrderStatus.REFUNDED,
              meta: { refundId: refund.id, method: 'MANUAL' },
            },
            tx,
          );

          return { id: refund.id, status: refund.status };
        },
        { timeout: env.ADMIN_WRITE_TX_TIMEOUT_MS },
      );
    } catch (e) {
      // The partial unique index `refund_one_active_per_order` (one non-FAILED
      // refund per order) is the exactly-once gate: a double-submit / second
      // refund lands here as P2002 → 409, never a double payout.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('A refund already exists for this order.');
      }
      throw e;
    }
  }

  /**
   * Prepaid (PhonePe) refund initiation. Persists the refund intent atomically
   * (payment CAS SUCCESS→REFUND_PENDING + Refund row + restock + event) and ONLY
   * THEN calls PhonePe — outside the transaction, so a slow/failed provider call
   * can never roll back the persisted, audited intent. A network failure here
   * leaves the refund PENDING for `recheck`; it never guesses success.
   */
  async initiate(orderId: string, dto: RefundOrderDto, actorId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        number: true,
        status: true,
        totalMinor: true,
        userId: true,
        items: { select: { productId: true, quantity: true } },
        payments: {
          where: { status: 'SUCCESS' },
          orderBy: { createdAt: 'desc' },
          select: { id: true, providerTxnId: true, providerPaymentId: true },
        },
        // ALL refunds (status + disposition): a non-FAILED one means a refund is
        // already in flight (→ honest "already in progress" 409, not the misleading
        // "no online payment" message once the payment is REFUND_PENDING); a prior
        // RETURNED one (incl. FAILED) means the goods were already restocked, so a
        // retry must not credit them again.
        refunds: { select: { status: true, disposition: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    assertRefundable(order.status);
    if (order.refunds.some((r) => r.status !== 'FAILED')) {
      throw new ConflictException('A refund is already in progress for this order.');
    }
    const restock = this.restockApplies(
      order.status,
      dto.disposition,
      order.refunds.map((r) => r.disposition),
    );
    const payment = order.payments[0];
    if (!payment) {
      throw new ConflictException(
        'No successful online payment to refund — use the manual (COD) refund.',
      );
    }
    if (!payment.providerPaymentId) {
      // Razorpay refunds are created against the pay_… id, written only by
      // the captured-settle path. PhonePe-era SUCCESS rows have none — those
      // are dashboard-refund territory, not this API's.
      throw new ConflictException(
        'The original payment has no provider payment id — cannot refund via the gateway.',
      );
    }

    // Persist the refund intent atomically. The payment CAS is the exactly-once
    // gate; the partial unique index is belt-and-braces (both → 409).
    let refund: { id: string; merchantRefundId: string };
    try {
      refund = await this.prisma.$transaction(
        async (tx) => {
          const claimed = await tx.payment.updateMany({
            where: { id: payment.id, status: 'SUCCESS' },
            data: { status: 'REFUND_PENDING' },
          });
          if (claimed.count !== 1) {
            throw new ConflictException('A refund is already in progress for this order.');
          }
          const created = await tx.refund.create({
            data: {
              orderId,
              paymentId: payment.id,
              amountMinor: order.totalMinor,
              method: 'GATEWAY',
              disposition: dto.disposition,
              status: 'PENDING',
              reason: dto.reason,
              actorId,
            },
            select: { id: true },
          });
          const merchantRefundId = deriveMerchantRefundId(created.id);
          await tx.refund.update({ where: { id: created.id }, data: { merchantRefundId } });

          if (restock) {
            for (const it of order.items) {
              await this.inventory.adjust({
                productId: it.productId,
                delta: it.quantity,
                reason: InventoryReason.RETURNED,
                actorId,
                reference: order.number,
                tx,
              });
            }
          }

          await this.events.record(
            {
              orderId,
              type: OrderEventType.RefundIssued,
              actorId,
              note: 'PhonePe refund initiated',
              meta: {
                method: 'GATEWAY',
                disposition: dto.disposition,
                amountMinor: order.totalMinor,
                merchantRefundId,
              },
            },
            tx,
          );
          return { id: created.id, merchantRefundId };
        },
        { timeout: env.ADMIN_WRITE_TX_TIMEOUT_MS },
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('A refund is already in progress for this order.');
      }
      throw e;
    }

    // Call Razorpay OUTSIDE the tx. A failure here leaves the refund PENDING;
    // recheck / the Phase-6 sweep recover it. Never re-mint the id — the
    // deterministic merchantRefundId is BOTH the X-Refund-Idempotency header
    // (replay-safe retries) and the receipt (payment-scoped reject-not-replay
    // net), so this create is exactly-once against the provider no matter how
    // many times it is re-sent.
    try {
      const res = await this.razorpay.createRefund({
        paymentId: payment.providerPaymentId,
        idempotencyKey: refund.merchantRefundId,
        receipt: refund.merchantRefundId,
        amountMinor: order.totalMinor,
        notes: { orderNumber: order.number },
      });
      // Report the ACTUAL post-settlement status, not an optimistic PENDING: an
      // immediate provider 'processed' shows PROCESSED, a definitive rejection
      // shows FAILED (payment already released), an accepted async refund PENDING.
      const settled = await this.adoptRefundCreateResult(refund.id, res);
      return { id: refund.id, status: settled };
    } catch {
      // Provider unreachable / timeout — the intent is persisted and stays PENDING
      // for recheck/sweep. Do NOT log the payload.
      this.logger.error(`refund:initiate provider call failed refundId=${refund.id} — left PENDING`);
      return { id: refund.id, status: 'PENDING' as const };
    }
  }

  /**
   * Adopt a refund-create outcome (initiate's first call OR a recovery
   * re-send). HTTP outcomes are data, not exceptions:
   *  - ok            → persist the provider refund id (no-clobber) and settle
   *                    from the entity's CURRENT status via the never-guess map;
   *  - in-flight-409 → the original create is still processing — stay PENDING;
   *  - definitive-4xx→ the provider REJECTED the create (never created) —
   *                    FAILED releases the payment CAS for a retry;
   *  - transient     → stay PENDING (5xx proves nothing).
   */
  private async adoptRefundCreateResult(
    refundId: string,
    res: RefundCreateResult,
  ): Promise<'PROCESSED' | 'FAILED' | 'PENDING'> {
    if (res.outcome === 'ok') {
      await this.prisma.refund.updateMany({
        where: { id: refundId, providerRefundId: null },
        data: { providerRefundId: res.refund.id },
      });
      const mapped = mapRazorpayRefundState(res.refund.status);
      await this.settle(refundId, mapped, res.refund.id, res.refund);
      return mapped;
    }
    if (res.outcome === 'definitive-4xx') {
      this.logger.warn(
        `refund:create rejected — marking FAILED refundId=${refundId} code=${res.errorCode} http=${res.httpStatus}`,
      );
      await this.settle(refundId, 'FAILED', undefined, {
        rejection: { httpStatus: res.httpStatus, errorCode: res.errorCode, reason: res.reason },
      });
      return 'FAILED';
    }
    // in-flight-409 / transient — not terminal, never guessed.
    this.logger.log(
      `refund:create non-terminal outcome=${res.outcome} refundId=${refundId} — left PENDING`,
    );
    return 'PENDING';
  }

  /**
   * The §3 recovery routine — shared by the manual admin recheck and the
   * Phase-6 refunds sweep. Probe ordering is STRUCTURAL, not conventional:
   *
   *  PROBE 1 (always, first): a FRESH provider state read — fetch by the
   *    persisted providerRefundId, else list the payment's refunds and match
   *    our receipt client-side. Only this probe can observe CURRENT state.
   *  PROBE 2 (only when probe 1 SUCCEEDED and found nothing): the idempotent
   *    re-send — its replay returns the SAVED ORIGINAL response, a stale
   *    snapshot that can prove the create landed but can NEVER serve as a
   *    state poll. It is therefore structurally incapable of masquerading as
   *    probe 1: it runs only inside the creation-ambiguity branch.
   *
   *  Conclude-FAILED demands positive evidence on BOTH legs (§3 item 3):
   *  a successful empty read AND a definitive 4xx re-send. Timeouts, 5xx,
   *  and failed reads always park PENDING — they can never release the
   *  payment CAS.
   */
  async recoverPendingRefund(refund: {
    id: string;
    merchantRefundId: string;
    providerRefundId: string | null;
    createdAt: Date;
    amountMinor: number;
    providerPaymentId: string | null;
  }): Promise<{ state: 'PROCESSED' | 'FAILED' | 'PENDING' }> {
    // ── PROBE 1: fresh state read ─────────────────────────────────────────
    let stateRead: RefundSweepInput['stateRead'];
    try {
      if (refund.providerRefundId) {
        const entity = await this.razorpay.fetchRefund(refund.providerRefundId);
        stateRead = {
          ok: true,
          matched: entity ? { id: entity.id, status: entity.status } : null,
        };
      } else if (refund.providerPaymentId) {
        const list = await this.razorpay.listRefundsForPayment(refund.providerPaymentId);
        const hit = list.find((e) => e.receipt === refund.merchantRefundId);
        stateRead = { ok: true, matched: hit ? { id: hit.id, status: hit.status } : null };
      } else {
        // No handle to read by — cannot gather evidence, cannot conclude.
        stateRead = { ok: false };
      }
    } catch {
      stateRead = { ok: false };
    }

    // ── PROBE 2: creation-ambiguity re-send (see doc comment) ─────────────
    let resend: RefundSweepInput['resend'] = { outcome: 'not-attempted' };
    if (stateRead.ok && stateRead.matched === null && refund.providerPaymentId) {
      try {
        const res = await this.razorpay.createRefund({
          paymentId: refund.providerPaymentId,
          idempotencyKey: refund.merchantRefundId,
          receipt: refund.merchantRefundId,
          amountMinor: refund.amountMinor,
        });
        if (res.outcome === 'ok') {
          resend = { outcome: 'replayed', refund: { id: res.refund.id, status: res.refund.status } };
        } else if (res.outcome === 'in-flight-409') {
          resend = { outcome: 'in-flight-409' };
        } else if (res.outcome === 'definitive-4xx') {
          // Contradiction guard: a duplicate-receipt rejection SAYS the
          // refund exists while our successful list read said it doesn't
          // (pagination edge). Contradictory evidence must never conclude —
          // park and let the next run's state read resolve it. This branches
          // on the provider's `reason` FIELD, not description prose.
          resend =
            res.reason === 'duplicate_receipt' ||
            (res.description ?? '').includes('Duplicate receipt')
              ? { outcome: 'transient' }
              : { outcome: 'definitive-4xx' };
        } else {
          resend = { outcome: 'transient' };
        }
      } catch {
        resend = { outcome: 'transient' };
      }
    }

    const decision = decideRefundSweep({
      refundAgeMin: (Date.now() - refund.createdAt.getTime()) / 60_000,
      concludeMinAgeMin: env.REFUND_CONCLUDE_MIN_AGE_MIN,
      stateRead,
      resend,
    });

    if (decision.action === 'settle-from-state') {
      await this.prisma.refund.updateMany({
        where: { id: refund.id, providerRefundId: null },
        data: { providerRefundId: decision.providerRefundId },
      });
      const mapped = mapRazorpayRefundState(decision.status);
      await this.settle(refund.id, mapped, decision.providerRefundId);
      return { state: mapped };
    }
    if (decision.action === 'conclude-failed') {
      this.logger.warn(
        `refund:recover concluding FAILED on positive evidence (empty list + definitive 4xx) refundId=${refund.id}`,
      );
      await this.settle(refund.id, 'FAILED');
      return { state: 'FAILED' };
    }
    return { state: 'PENDING' };
  }

  /**
   * Idempotent settlement — the SINGLE money-state transition, shared by the
   * PhonePe callback and `recheck`. Only a PENDING refund transitions; the
   * `updateMany where status:PENDING` claim makes a callback racing a recheck a
   * safe no-op on whichever loses (claimed.count !== 1 → return). PENDING/unknown
   * states never transition — the order never shows REFUNDED unless money moved.
   */
  async settle(
    refundId: string,
    state: 'PROCESSED' | 'FAILED' | 'PENDING',
    providerRefundId?: string,
    raw?: unknown,
  ): Promise<void> {
    if (state === 'PENDING') return; // not terminal — keep polling/awaiting callback
    await this.prisma.$transaction(
      async (tx) => {
        const claimed = await tx.refund.updateMany({
          where: { id: refundId, status: 'PENDING' },
          data: {
            status: state,
            providerRefundId: providerRefundId ?? undefined,
            rawResponse: (raw ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        });
        if (claimed.count !== 1) {
          // Already settled by the other entry point. ONE addition (Razorpay
          // plan §3 item 4, placed HERE so it is atomic with the claim): a
          // terminal provider SUCCESS arriving after this refund was
          // concluded FAILED is a books contradiction (customer refunded,
          // books say not) — persist the tripwire, never silently drop it.
          // The blocked updateMany above guarantees the concurrent writer
          // has committed, so this re-read deterministically sees its state.
          if (state === 'PROCESSED') {
            const row = await tx.refund.findUnique({
              where: { id: refundId },
              select: { status: true, orderId: true },
            });
            if (row?.status === 'FAILED') {
              const already = await tx.orderEvent.findFirst({
                where: { orderId: row.orderId, type: 'refund_settled_after_conclude' },
                select: { id: true },
              });
              if (!already) {
                await this.events.record(
                  {
                    orderId: row.orderId,
                    type: 'refund_settled_after_conclude',
                    note: 'Provider reports this refund PROCESSED but it was concluded FAILED — books contradiction, reconcile manually.',
                    meta: { refundId, providerRefundId: providerRefundId ?? null },
                  },
                  tx,
                );
              }
            }
          }
          return;
        }
        const refund = await tx.refund.findUnique({
          where: { id: refundId },
          select: { orderId: true, paymentId: true },
        });
        if (!refund) return;

        if (state === 'PROCESSED') {
          if (refund.paymentId) {
            await tx.payment.update({ where: { id: refund.paymentId }, data: { status: 'REFUNDED' } });
          }
          await tx.order.update({ where: { id: refund.orderId }, data: { status: OrderStatus.REFUNDED } });
          await this.events.record(
            {
              orderId: refund.orderId,
              type: 'refund_settled',
              toStatus: OrderStatus.REFUNDED,
              meta: { refundId },
            },
            tx,
          );
        } else {
          // FAILED — money never moved. Free the payment back to SUCCESS so a
          // retry can re-CAS it; the order is untouched (never stuck REFUNDED,
          // never stuck REFUND_PENDING). The restock from initiation is NOT
          // reversed (the goods are physically back).
          if (refund.paymentId) {
            await tx.payment.update({ where: { id: refund.paymentId }, data: { status: 'SUCCESS' } });
          }
          await this.events.record(
            {
              orderId: refund.orderId,
              type: 'refund_failed',
              note: 'PhonePe reported the refund failed',
              meta: { refundId },
            },
            tx,
          );
        }
      },
      { timeout: env.ADMIN_WRITE_TX_TIMEOUT_MS },
    );
  }

  /**
   * Adapt a provider response into a settlement. Unknown/unexpected provider
   * states map to PENDING (never guessed as SUCCESS/FAILED) and are logged so
   * ops can see a refund that PhonePe reported in a shape we don't model yet.
   */
  async settleFromProvider(
    refundId: string,
    res: PhonepeRefundResult,
  ): Promise<'PROCESSED' | 'FAILED' | 'PENDING'> {
    const mapped = mapRefundState(res.state, { httpStatus: res.httpStatus, success: res.success });
    if (mapped === 'FAILED' && res.state !== 'FAILED') {
      // FAILED via a definitive provider rejection (not a terminal FAILED state) —
      // e.g. EXCESS_REFUND_AMOUNT / TXN_OLDER_THAN_LIMIT / NOT_FOUND. Log for ops.
      this.logger.warn(
        `refund:settle provider rejected — marking FAILED refundId=${refundId} state=${res.state} code=${res.code} http=${res.httpStatus}`,
      );
    } else if (mapped === 'PENDING' && res.state !== 'PENDING') {
      this.logger.warn(
        `refund:settle unknown provider state — parking PENDING refundId=${refundId} state=${res.state} code=${res.code} http=${res.httpStatus}`,
      );
    }
    await this.settle(refundId, mapped, res.providerRefundId, res.raw);
    return mapped;
  }

  /**
   * Failure-honesty escape hatch. Polls PhonePe Check-Status for the order's
   * active PENDING PhonePe refund and adopts the true state via the same
   * idempotent `settle` the callback uses — so a recheck racing a late callback
   * cannot double-apply. No-op target for COD/settled refunds (none PENDING).
   */
  async recheck(orderId: string) {
    const refund = await this.prisma.refund.findFirst({
      where: { orderId, method: 'GATEWAY', status: 'PENDING' },
      select: {
        id: true,
        merchantRefundId: true,
        providerRefundId: true,
        createdAt: true,
        amountMinor: true,
        payment: { select: { providerPaymentId: true } },
      },
    });
    if (!refund?.merchantRefundId) {
      throw new NotFoundException('No pending gateway refund to re-check for this order.');
    }
    const { state } = await this.recoverPendingRefund({
      id: refund.id,
      merchantRefundId: refund.merchantRefundId,
      providerRefundId: refund.providerRefundId,
      createdAt: refund.createdAt,
      amountMinor: refund.amountMinor,
      providerPaymentId: refund.payment?.providerPaymentId ?? null,
    });
    return { id: refund.id, state };
  }
}
