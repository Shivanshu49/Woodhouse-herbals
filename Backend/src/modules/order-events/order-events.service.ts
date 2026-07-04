import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { orderEventCreateData, RecordOrderEventInput } from './order-event-data';

@Injectable()
export class OrderEventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Append one timeline event. Pass the caller's `tx` to write it in-band with
   * the status change so an event never records without its transition.
   */
  async record(input: RecordOrderEventInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.orderEvent.create({ data: orderEventCreateData(input) });
  }
}
