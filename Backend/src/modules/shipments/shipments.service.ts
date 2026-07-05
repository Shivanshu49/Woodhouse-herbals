import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { env } from '../../common/config/env';
import { OrderEventsService } from '../order-events/order-events.service';
import { OrderEventType } from '../order-events/order-event-types';
import { InvoiceService } from '../invoices/invoice.service';

interface CreateInput {
  orderNumber: string;
  courier: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: Date;
}

@Injectable()
export class ShipmentsService {
  private readonly logger = new Logger(ShipmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: OrderEventsService,
    private readonly invoices: InvoiceService,
  ) {}

  /**
   * Create a shipment row for a paid order and stamp the order status.
   * Idempotent on (orderId, trackingNumber) — re-running with the same
   * tracking number is a no-op so retries from the admin UI are safe.
   */
  async create(input: CreateInput) {
    const order = await this.prisma.order.findUnique({
      where: { number: input.orderNumber },
      select: { id: true, status: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PAID && order.status !== OrderStatus.PROCESSING) {
      throw new BadRequestException(
        `Cannot ship an order in status ${order.status.toLowerCase()}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = input.trackingNumber
        ? await tx.shipment.findFirst({
            where: { orderId: order.id, trackingNumber: input.trackingNumber },
          })
        : null;
      if (existing) return existing;

      const shipment = await tx.shipment.create({
        data: {
          orderId: order.id,
          courier: input.courier,
          trackingNumber: input.trackingNumber,
          trackingUrl: input.trackingUrl,
          estimatedDelivery: input.estimatedDelivery,
          status: ShipmentStatus.LABEL_CREATED,
          events: {
            create: {
              status: ShipmentStatus.LABEL_CREATED,
              description: 'Shipping label created',
            },
          },
        },
        include: { events: true },
      });

      // Atomic PAID→PROCESSING; record the event only if THIS call transitioned
      // the order (count 1), never off a stale pre-read.
      const movedToProcessing = await tx.order.updateMany({
        where: { id: order.id, status: OrderStatus.PAID },
        data: { status: OrderStatus.PROCESSING },
      });
      if (movedToProcessing.count === 1) {
        await this.events.record(
          {
            orderId: order.id,
            type: OrderEventType.StatusChanged,
            fromStatus: OrderStatus.PAID,
            toStatus: OrderStatus.PROCESSING,
            meta: { via: 'shipment_created' },
          },
          tx,
        );
      }

      return shipment;
    }, { timeout: env.ADMIN_WRITE_TX_TIMEOUT_MS });
  }

  /**
   * Append a status event and roll the shipment forward. Records terminal
   * states on both shipment and parent order.
   */
  async updateStatus(shipmentId: string, status: ShipmentStatus, description?: string) {
    const { shippedNow, orderId } = await this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
        select: { id: true, status: true, orderId: true },
      });
      if (!shipment) throw new NotFoundException('Shipment not found');

      const now = new Date();
      await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status,
          shippedAt:
            shipment.status === ShipmentStatus.LABEL_CREATED && status === ShipmentStatus.IN_TRANSIT
              ? now
              : undefined,
          deliveredAt: status === ShipmentStatus.DELIVERED ? now : undefined,
        },
      });

      await tx.shipmentEvent.create({
        data: { shipmentId, status, description, occurredAt: now },
      });

      // Read the order's prior status so the event's fromStatus is accurate and
      // we can skip a redundant event when the order status doesn't actually move
      // (e.g. IN_TRANSIT then OUT_FOR_DELIVERY both map to SHIPPED).
      const orderRow = await tx.order.findUnique({
        where: { id: shipment.orderId },
        select: { status: true },
      });
      const prior = orderRow?.status ?? null;

      let shippedNow = false;
      if (status === ShipmentStatus.IN_TRANSIT || status === ShipmentStatus.OUT_FOR_DELIVERY) {
        // Atomic move to SHIPPED from a LEGAL source only. A whitelist (not a
        // `not: SHIPPED` negative match) both preserves idempotency — a 2nd
        // IN_TRANSIT/OUT_FOR_DELIVERY finds the order already SHIPPED → count 0 →
        // no duplicate event — AND refuses illegal sources: a CANCELLED order
        // must never regress to SHIPPED (which would mint a GST invoice for a
        // cancelled, restocked order via the auto-gen hook below).
        const moved = await tx.order.updateMany({
          where: {
            id: shipment.orderId,
            status: { in: [OrderStatus.PAID, OrderStatus.PROCESSING] },
          },
          data: { status: OrderStatus.SHIPPED },
        });
        if (moved.count === 1) {
          shippedNow = true;
          await this.events.record(
            {
              orderId: shipment.orderId,
              type: OrderEventType.StatusChanged,
              fromStatus: prior,
              toStatus: OrderStatus.SHIPPED,
              meta: { via: 'shipment_status', shipmentStatus: status },
            },
            tx,
          );
        }
      } else if (status === ShipmentStatus.DELIVERED) {
        // DELIVERED only from a legal in-fulfilment source (SHIPPED, or a direct
        // PROCESSING→DELIVERED when a courier skips the in-transit scan). Excludes
        // CANCELLED/PENDING/PAID and is idempotent (already-DELIVERED → count 0).
        const moved = await tx.order.updateMany({
          where: {
            id: shipment.orderId,
            status: { in: [OrderStatus.PROCESSING, OrderStatus.SHIPPED] },
          },
          data: { status: OrderStatus.DELIVERED },
        });
        if (moved.count === 1) {
          await this.events.record(
            {
              orderId: shipment.orderId,
              type: OrderEventType.StatusChanged,
              fromStatus: prior,
              toStatus: OrderStatus.DELIVERED,
              meta: { via: 'shipment_status', shipmentStatus: status },
            },
            tx,
          );
        }
      }
      return { shippedNow, orderId: shipment.orderId };
    }, { timeout: env.ADMIN_WRITE_TX_TIMEOUT_MS });

    // Auto-generate the GST invoice at the SHIPPED transition (correct time-of-
    // supply) — best-effort, AFTER the tx commits so a slow/failing invoice never
    // blocks the shipment. A 503 (store profile unset) leaves it for on-demand.
    if (shippedNow) {
      this.invoices
        .generateForOrder(orderId)
        .catch((e) =>
          this.logger.warn(`invoice auto-gen at SHIPPED failed order=${orderId}: ${(e as Error).message}`),
        );
    }
  }

  /** Owner-scoped lookup for the customer order-tracking page. */
  forOrder(orderId: string) {
    return this.prisma.shipment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: { events: { orderBy: { occurredAt: 'desc' } } },
    });
  }
}
