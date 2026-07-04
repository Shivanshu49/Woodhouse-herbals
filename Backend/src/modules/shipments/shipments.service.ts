import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { env } from '../../common/config/env';
import { OrderEventsService } from '../order-events/order-events.service';
import { OrderEventType } from '../order-events/order-event-types';

interface CreateInput {
  orderNumber: string;
  courier: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: Date;
}

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: OrderEventsService,
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

      if (order.status === OrderStatus.PAID) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.PROCESSING },
        });
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
    return this.prisma.$transaction(async (tx) => {
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

      if (status === ShipmentStatus.IN_TRANSIT || status === ShipmentStatus.OUT_FOR_DELIVERY) {
        await tx.order.update({
          where: { id: shipment.orderId },
          data: { status: OrderStatus.SHIPPED },
        });
        if (prior !== OrderStatus.SHIPPED) {
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
        await tx.order.update({
          where: { id: shipment.orderId },
          data: { status: OrderStatus.DELIVERED },
        });
        if (prior !== OrderStatus.DELIVERED) {
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
    }, { timeout: env.ADMIN_WRITE_TX_TIMEOUT_MS });
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
