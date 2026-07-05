import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InventoryReason, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrderEventsService } from '../order-events/order-events.service';
import { OrderEventType } from '../order-events/order-event-types';
import { InventoryService } from '../inventory/inventory.service';
import { env } from '../../common/config/env';
import { PhonepeRefundClient } from '../phonepe/phonepe-refund.client';
import { assertRefundable, shouldRestock } from './refund-transitions';
import { ManualRefundDto } from './dto/manual-refund.dto';

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
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    assertRefundable(order.status);
    if (order.payments.length) {
      throw new ConflictException(
        'This order was paid online — use the PhonePe refund, not the manual (COD) refund.',
      );
    }

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

          if (shouldRestock(dto.disposition)) {
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
}
