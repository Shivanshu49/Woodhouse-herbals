import type { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

export interface AdminOrderWhereInput {
  q?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  dateFrom?: string; // ISO 8601
  dateTo?: string; // ISO 8601
}

export function buildAdminOrderWhere(input: AdminOrderWhereInput): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};

  if (input.status) where.status = input.status;
  if (input.paymentStatus) where.payments = { some: { status: input.paymentStatus } };

  if (input.dateFrom || input.dateTo) {
    where.placedAt = {
      ...(input.dateFrom ? { gte: new Date(input.dateFrom) } : {}),
      ...(input.dateTo ? { lte: new Date(input.dateTo) } : {}),
    };
  }

  const q = input.q?.trim();
  if (q) {
    where.OR = [
      { number: { contains: q, mode: 'insensitive' } },
      { shippingFullName: { contains: q, mode: 'insensitive' } },
      { shippingPhone: { contains: q, mode: 'insensitive' } },
      { user: { is: { email: { contains: q, mode: 'insensitive' } } } },
    ];
  }

  return where;
}
