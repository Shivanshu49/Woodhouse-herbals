import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StoreProfileService } from '../store-settings/store-profile.service';
import { ObjectStorageService } from '../../common/storage/object-storage.service';
import { env } from '../../common/config/env';
import { isInvoiceable } from './gst-rate';
import { financialYearOf, formatInvoiceNumber } from './invoice-number';
import { buildSnapshot, InvoiceSnapshot, SnapshotOrder } from './invoice-snapshot';
import { renderInvoicePdf } from './invoice-pdf';

const ORDER_INCLUDE = {
  items: { include: { product: { select: { hsnCode: true, gstRate: true } } } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: StoreProfileService,
    private readonly storage: ObjectStorageService,
  ) {}

  /**
   * Idempotent: creates the immutable Invoice row (FY number + frozen snapshot)
   * exactly once. The counter increment and the row insert share one transaction,
   * so a losing race rolls BOTH back — no burned invoice number, no gap.
   */
  async generateForOrder(orderId: string): Promise<{ number: string; issuedAt: Date }> {
    const existing = await this.prisma.invoice.findUnique({
      where: { orderId },
      select: { number: true, issuedAt: true },
    });
    if (existing) return existing;

    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Order not found');
    if (!isInvoiceable(order.status, order.paymentMethod)) {
      throw new ConflictException(`An order in ${order.status} status is not invoiceable yet.`);
    }
    const profile = await this.profiles.getInvoiceProfile(); // 503 if unconfigured
    const issuedAt = new Date();
    const fy = financialYearOf(issuedAt);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.invoiceCounter.upsert({ where: { fy }, create: { fy, next: 1 }, update: {} });
          const { next } = await tx.invoiceCounter.update({
            where: { fy },
            data: { next: { increment: 1 } },
            select: { next: true },
          });
          const number = formatInvoiceNumber(fy, next - 1);
          const snapshot = buildSnapshot({
            order: order as unknown as SnapshotOrder,
            profile,
            number,
            issuedAt,
          });
          return await tx.invoice.create({
            data: { orderId, number, fy, snapshot: snapshot as unknown as Prisma.InputJsonValue, issuedAt },
            select: { number: true, issuedAt: true },
          });
        },
        { timeout: env.ADMIN_WRITE_TX_TIMEOUT_MS },
      );
    } catch (e) {
      // Concurrent generate raced us — the orderId unique index rejected the loser
      // (whose counter increment rolled back too). Return the winner.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const won = await this.prisma.invoice.findUnique({
          where: { orderId },
          select: { number: true, issuedAt: true },
        });
        if (won) return won;
      }
      throw e;
    }
  }

  getForOrder(orderId: string) {
    return this.prisma.invoice.findUnique({ where: { orderId } });
  }

  /**
   * Streams the PDF, rendering + caching it from the immutable snapshot on first
   * request (R2 when configured, else the dev `pdfBytes` fallback). Re-download
   * re-renders the SAME snapshot → identical bytes.
   */
  async getPdf(orderId: string): Promise<{ buffer: Buffer; filename: string }> {
    await this.generateForOrder(orderId); // ensure it exists (idempotent)
    const inv = await this.prisma.invoice.findUnique({ where: { orderId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    const filename = `${inv.number}.pdf`;

    if (inv.r2Key && this.storage.isConfigured()) {
      return { buffer: await this.storage.get(inv.r2Key), filename };
    }
    if (inv.pdfBytes) return { buffer: Buffer.from(inv.pdfBytes), filename };

    const buffer = await renderInvoicePdf(inv.snapshot as unknown as InvoiceSnapshot);
    if (this.storage.isConfigured()) {
      const key = `invoices/${inv.fy}/${inv.number}.pdf`;
      await this.storage.put(key, buffer, 'application/pdf');
      await this.prisma.invoice.update({ where: { orderId }, data: { r2Key: key } });
    } else {
      await this.prisma.invoice.update({ where: { orderId }, data: { pdfBytes: buffer } });
    }
    return { buffer, filename };
  }
}
