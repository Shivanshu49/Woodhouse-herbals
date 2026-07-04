import type { OrderStatus, Prisma } from '@prisma/client';

export interface RecordOrderEventInput {
  orderId: string;
  type: string;
  fromStatus?: OrderStatus | null;
  toStatus?: OrderStatus | null;
  actorId?: string | null;
  note?: string | null;
  meta?: Prisma.InputJsonValue;
}

/**
 * Pure map to the Prisma create payload. Statuses default to null (nullable
 * columns); the optional relation/scalars default to undefined (omit → leave unset).
 */
export function orderEventCreateData(
  input: RecordOrderEventInput,
): Prisma.OrderEventUncheckedCreateInput {
  return {
    orderId: input.orderId,
    type: input.type,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    actorId: input.actorId ?? undefined,
    note: input.note ?? undefined,
    meta: input.meta ?? undefined,
  };
}
