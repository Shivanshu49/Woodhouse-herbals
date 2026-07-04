import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { excludeDeleted } from '../../common/prisma/soft-delete';
import { toMoney } from '../../common/utils/money';

@Injectable()
export class HomepageService {
  constructor(private readonly prisma: PrismaService) {}

  async getPayload() {
    const [offerStrip, hero, concerns, bestsellers, newArrivals, comboPacks] = await Promise.all([
      this.prisma.offerStripItem.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.heroBanner.findFirst({ where: { active: true }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.concern.findMany({ orderBy: { sortOrder: 'asc' }, take: 8 }),
      // Storefront must never surface draft/scheduled or soft-deleted products.
      this.prisma.product.findMany({
        where: excludeDeleted({ status: 'PUBLISHED', badges: { some: { tone: 'BESTSELLER' } } }),
        take: 8,
        include: { badges: true, concerns: { include: { concern: true } } },
      }),
      this.prisma.product.findMany({
        where: excludeDeleted({ status: 'PUBLISHED', badges: { some: { tone: 'NEW' } } }),
        take: 8,
        include: { badges: true, concerns: { include: { concern: true } } },
      }),
      this.prisma.product.findMany({
        where: excludeDeleted({ status: 'PUBLISHED', isCombo: true }),
        take: 4,
        include: { badges: true, concerns: { include: { concern: true } } },
      }),
    ]);

    return {
      offerStrip: offerStrip.map((o) => ({ headline: o.headline, code: o.code, href: o.href })),
      hero,
      concerns: concerns.map((c) => ({
        slug: c.slug,
        title: c.title,
        description: c.description ?? '',
        imageUrl: c.imageUrl ?? '',
        accent: (c.accent ?? 'forest') as 'forest' | 'clay' | 'sage' | 'sand',
      })),
      bestsellers: bestsellers.map((p) => this.toSummary(p)),
      newArrivals: newArrivals.map((p) => this.toSummary(p)),
      comboPacks: comboPacks.map((p) => this.toSummary(p)),
      trust: [
        { icon: 'leaf', title: 'Herbal & natural', subtitle: 'Plant-first formulations' },
        { icon: 'shield', title: 'Dermat-tested', subtitle: 'Safe for daily use' },
        { icon: 'sparkles', title: 'GMP certified', subtitle: 'Made in our own facility' },
        { icon: 'heart', title: 'Cruelty-free', subtitle: 'Never tested on animals' },
      ],
    };
  }

  private toSummary(p: any) {
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      shortDescription: p.shortDescription,
      price: toMoney(p.priceMinor),
      compareAtPrice: p.compareAtPriceMinor ? toMoney(p.compareAtPriceMinor) : null,
      thumbnail: { url: p.thumbnailUrl, alt: p.thumbnailAlt },
      rating: p.rating,
      reviewCount: p.reviewCount,
      badges: p.badges?.map((b: any) => ({ label: b.label, tone: b.tone.toLowerCase() })) ?? [],
      category: p.category.toLowerCase().replace(/_/g, '-'),
      concerns: p.concerns?.map((c: any) => c.concern.slug) ?? [],
      skinTypes: p.skinTypes?.map((s: string) => s.toLowerCase()) ?? [],
      inStock: p.inStock,
    };
  }
}
