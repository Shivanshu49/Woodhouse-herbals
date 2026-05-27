import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const TRENDING = ['Vit C serum', 'Hair fall oil', 'Anti-acne combo', 'D-Tan face wash', 'Niacinamide'];

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async suggest(q: string) {
    const query = q.trim();
    if (!query) {
      const trending = await this.prisma.product.findMany({
        take: 5,
        orderBy: { reviewCount: 'desc' },
        select: { name: true, slug: true, thumbnailUrl: true, priceMinor: true },
      });
      return {
        suggestions: trending.map((p) => ({
          type: 'product' as const,
          label: p.name,
          href: `/shop/${p.slug}`,
          image: p.thumbnailUrl,
          priceLabel: `₹${(p.priceMinor / 100).toFixed(0)}`,
        })),
        trending: TRENDING,
      };
    }

    const products = await this.prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { shortDescription: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 6,
      select: { name: true, slug: true, thumbnailUrl: true, priceMinor: true },
    });

    const concerns = await this.prisma.concern.findMany({
      where: { OR: [{ title: { contains: query, mode: 'insensitive' } }, { slug: { contains: query, mode: 'insensitive' } }] },
      take: 4,
    });

    return {
      suggestions: [
        ...products.map((p) => ({
          type: 'product' as const,
          label: p.name,
          href: `/shop/${p.slug}`,
          image: p.thumbnailUrl,
          priceLabel: `₹${(p.priceMinor / 100).toFixed(0)}`,
        })),
        ...concerns.map((c) => ({
          type: 'concern' as const,
          label: c.title,
          href: `/shop?concern=${c.slug}`,
        })),
      ],
      trending: TRENDING,
    };
  }
}
