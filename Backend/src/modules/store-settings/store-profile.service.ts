import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildInvoiceProfile, InvoiceProfile } from './store-profile';

@Injectable()
export class StoreProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /** The store's invoice profile from StoreSetting; 503 if not fully configured. */
  async getInvoiceProfile(): Promise<InvoiceProfile> {
    const rows = await this.prisma.storeSetting.findMany({
      where: { key: { startsWith: 'store.' } },
      select: { key: true, value: true },
    });
    const raw = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    try {
      return buildInvoiceProfile(raw as Record<string, unknown>);
    } catch (e) {
      throw new ServiceUnavailableException((e as Error).message);
    }
  }
}
