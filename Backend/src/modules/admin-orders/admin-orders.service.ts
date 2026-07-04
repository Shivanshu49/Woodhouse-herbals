import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryReason, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { pageArgs } from '../../common/dto/pagination.dto';
import { env } from '../../common/config/env';
import { InventoryService } from '../inventory/inventory.service';
import { OrderEventsService } from '../order-events/order-events.service';
import { OrderEventType } from '../order-events/order-event-types';
import { buildAdminOrderWhere } from './admin-order-where';
import { buildAdminOrderOrderBy } from './admin-order-sort';
import { toOrderSummary } from './admin-order-summary';
import { assertCancellable, CANCELLABLE_STATUSES } from './order-transitions';
import { ListAdminOrdersDto } from './dto/list-admin-orders.dto';
import { AddOrderNoteDto } from './dto/add-order-note.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';

/** Thin list rows. Latest payment first so the summary mapper reads payments[0]. */
const SUMMARY_SELECT = {
  id: true,
  number: true,
  placedAt: true,
  status: true,
  paymentMethod: true,
  totalMinor: true,
  shippingFullName: true,
  userId: true,
  payments: { select: { status: true }, orderBy: { createdAt: 'desc' }, take: 1 },
  _count: { select: { items: true } },
} satisfies Prisma.OrderSelect;

/** Full detail — the D3 UI reads all of this. Address is denormalized on Order. */
const DETAIL_INCLUDE = {
  items: true,
  payments: { orderBy: { createdAt: 'desc' } },
  shipments: {
    include: { events: { orderBy: { occurredAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  },
  notes: { orderBy: { createdAt: 'asc' } },
  refunds: { orderBy: { createdAt: 'desc' } },
  events: {
    orderBy: { createdAt: 'asc' },
    include: { actor: { select: { id: true, fullName: true } } },
  },
  user: { select: { id: true, fullName: true, email: true, phone: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: OrderEventsService,
    private readonly inventory: InventoryService,
  ) {}

  async list(dto: ListAdminOrdersDto) {
    const where = buildAdminOrderWhere({
      q: dto.q,
      status: dto.status,
      paymentStatus: dto.paymentStatus,
      paymentMethod: dto.paymentMethod,
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
    });
    const orderBy = buildAdminOrderOrderBy(dto.sort);
    const { skip, take, page, perPage } = pageArgs(dto);

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({ where, orderBy, skip, take, select: SUMMARY_SELECT }),
      this.prisma.order.count({ where }),
    ]);

    return { items: rows.map(toOrderSummary), total, page, perPage };
  }

  async getById(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /** Append an admin note + a note_added timeline event, in one transaction. */
  async addNote(id: string, dto: AddOrderNoteDto, actorId: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!order) throw new NotFoundException('Order not found');

    return this.prisma.$transaction(async (tx) => {
      const note = await tx.orderNote.create({
        data: {
          orderId: id,
          authorId: actorId,
          body: dto.body,
          isCustomerVisible: dto.isCustomerVisible ?? false,
        },
      });
      await this.events.record(
        {
          orderId: id,
          type: OrderEventType.NoteAdded,
          actorId,
          note: dto.isCustomerVisible ? 'Added a customer-visible note' : 'Added an internal note',
        },
        tx,
      );
      return note;
    }, { timeout: env.ADMIN_WRITE_TX_TIMEOUT_MS });
  }

  /**
   * Cancel a pre-shipment order (§2.1). Restocks each line (goods never shipped,
   * §2.2), flips status to CANCELLED, and records a status_changed event — all in
   * one transaction so stock, status, and the audit event move together.
   */
  async cancel(id: string, dto: CancelOrderDto, actorId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        status: true,
        items: { select: { productId: true, quantity: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    assertCancellable(order.status); // fast-fail 409 for the common case

    return this.prisma.$transaction(async (tx) => {
      // The REAL guard: atomically CLAIM the cancellation as the first write,
      // gated on the order still being cancellable. This closes two races the
      // pre-read check above cannot — (a) a concurrent shipment flipping the
      // order to SHIPPED (TOCTOU), and (b) a second concurrent cancel
      // (double-restock). A lost race yields count 0 → 409, rolling the whole
      // transaction back before any stock is returned or event written.
      const claimed = await tx.order.updateMany({
        where: { id, status: { in: [...CANCELLABLE_STATUSES] } },
        data: { status: OrderStatus.CANCELLED },
      });
      if (claimed.count !== 1) {
        throw new ConflictException(
          'Order status changed concurrently and can no longer be cancelled — reload and retry.',
        );
      }

      for (const item of order.items) {
        await this.inventory.adjust({
          productId: item.productId,
          delta: item.quantity, // positive → return reserved stock
          reason: InventoryReason.ORDER_CANCELLED,
          actorId,
          reference: order.number,
          tx,
        });
      }
      await this.events.record(
        {
          orderId: id,
          type: OrderEventType.StatusChanged,
          fromStatus: order.status,
          toStatus: OrderStatus.CANCELLED,
          actorId,
          note: dto.reason,
        },
        tx,
      );
      return { id, status: OrderStatus.CANCELLED };
    }, { timeout: env.ADMIN_WRITE_TX_TIMEOUT_MS });
  }
}
