import {
  ConflictException,
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
import { PhonepeRefundClient, PhonepeRefundResult } from '../phonepe/phonepe-refund.client';
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: OrderEventsService,
    private readonly inventory: InventoryService,
    private readonly phonepe: PhonepeRefundClient,
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
          select: { id: true, providerTxnId: true },
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
    if (!payment.providerTxnId) {
      throw new ConflictException(
        'The original payment has no provider transaction id — cannot refund via PhonePe.',
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

    // Call PhonePe OUTSIDE the tx. A failure here leaves the refund PENDING; the
    // admin reconciles with `recheck`. Never re-mint the id — recheck polls this
    // same merchantRefundId.
    try {
      const res = await this.phonepe.refund({
        merchantRefundId: refund.merchantRefundId,
        originalTxnId: payment.providerTxnId,
        merchantUserId: order.userId ?? order.id,
        amountMinor: order.totalMinor,
      });
      // Persist the provider refund id even while PENDING (visibility + recheck
      // dedupe), without clobbering a value a racing callback already set.
      if (res.providerRefundId) {
        await this.prisma.refund.updateMany({
          where: { id: refund.id, providerRefundId: null },
          data: { providerRefundId: res.providerRefundId },
        });
      }
      // Report the ACTUAL post-settlement status, not an optimistic PENDING: an
      // immediate provider COMPLETED shows PROCESSED, a hard rejection shows FAILED
      // (payment already released), an accepted async refund shows PENDING.
      const settled = await this.settleFromProvider(refund.id, res);
      return { id: refund.id, status: settled };
    } catch {
      // Provider unreachable / timeout — the intent is persisted and stays PENDING
      // for `recheck`. Do NOT log the payload (may echo signed material).
      this.logger.error(`refund:initiate provider call failed refundId=${refund.id} — left PENDING`);
      return { id: refund.id, status: 'PENDING' as const };
    }
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
      select: { id: true, merchantRefundId: true },
    });
    if (!refund?.merchantRefundId) {
      throw new NotFoundException('No pending PhonePe refund to re-check for this order.');
    }
    const res = await this.phonepe.status(refund.merchantRefundId);
    await this.settleFromProvider(refund.id, res);
    return { id: refund.id, state: res.state };
  }
}
