import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { pageArgs } from '../../common/dto/pagination.dto';
import { buildAdminOrderWhere } from './admin-order-where';
import { buildAdminOrderOrderBy } from './admin-order-sort';
import { toOrderSummary } from './admin-order-summary';
import { ListAdminOrdersDto } from './dto/list-admin-orders.dto';

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
  constructor(private readonly prisma: PrismaService) {}

  async list(dto: ListAdminOrdersDto) {
    const where = buildAdminOrderWhere({
      q: dto.q,
      status: dto.status,
      paymentStatus: dto.paymentStatus,
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
}
