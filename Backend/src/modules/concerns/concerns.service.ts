import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { excludeDeleted } from '../../common/prisma/soft-delete';

/** Public product fields only — never expose internal cost/margin on the storefront. */
const PUBLIC_PRODUCT_SELECT = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  thumbnailUrl: true,
  thumbnailAlt: true,
  priceMinor: true,
  compareAtPriceMinor: true,
  category: true,
  inStock: true,
  featured: true,
  rating: true,
  reviewCount: true,
} as const;

@Injectable()
export class ConcernsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.concern.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  findBySlug(slug: string) {
    return this.prisma.concern.findUnique({
      where: { slug },
      // Only PUBLISHED, non-deleted products, and only public fields — the raw
      // relation exposed internal cost/margin and unpublished products.
      include: {
        products: {
          where: { product: excludeDeleted({ status: 'PUBLISHED' }) },
          include: { product: { select: PUBLIC_PRODUCT_SELECT } },
        },
      },
    });
  }
}
