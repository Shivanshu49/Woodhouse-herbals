import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductCategory } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ListProductsDto, ProductSort } from './dto/list-products.dto';
import { toMoney } from '../../common/utils/money';
import { excludeDeleted } from '../../common/prisma/soft-delete';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(dto: ListProductsDto) {
    // Storefront must never leak draft/scheduled products — only PUBLISHED
    // rows are shoppable.
    const where: Prisma.ProductWhereInput = { status: 'PUBLISHED' };

    if (dto.category?.length) {
      const cats = dto.category
        .map((c) => this.toEnumCategory(c))
        .filter((c): c is ProductCategory => c !== undefined);
      if (cats.length) where.category = { in: cats };
    }
    if (dto.skinType?.length) {
      where.skinTypes = { hasSome: dto.skinType.map((s) => s.toUpperCase()) as never };
    }
    if (dto.concern?.length) {
      where.concerns = { some: { concern: { slug: { in: dto.concern } } } };
    }
    if (dto.minRating) {
      where.rating = { gte: dto.minRating };
    }
    if (dto.price) {
      const [lo, hi] = dto.price.split('-');
      where.priceMinor = {};
      if (lo) (where.priceMinor as Prisma.IntFilter).gte = Number(lo) * 100;
      if (hi) (where.priceMinor as Prisma.IntFilter).lte = Number(hi) * 100;
    }

    const orderBy = this.buildOrderBy(dto.sort);
    const page = dto.page ?? 1;
    const perPage = dto.perPage ?? 24;

    const safeWhere = excludeDeleted(where);
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where: safeWhere,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
        include: { badges: true, concerns: { include: { concern: true } } },
      }),
      this.prisma.product.count({ where: safeWhere }),
    ]);

    return {
      items: items.map((p) => this.toSummary(p)),
      total,
      page,
      perPage,
      facets: await this.buildFacets(where),
    };
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      // Soft-delete-aware: deleted products are 404 even though they still
      // exist for historical orders. Also PUBLISHED-only: a draft/scheduled
      // slug must 404 on the storefront just like a deleted one.
      where: excludeDeleted({ slug, status: 'PUBLISHED' }),
      include: {
        badges: true,
        gallery: { orderBy: { sortOrder: 'asc' } },
        ingredients: { orderBy: { sortOrder: 'asc' } },
        concerns: { include: { concern: true } },
      },
    });
    if (!product) throw new NotFoundException(`Product ${slug} not found`);

    const recommended = await this.prisma.product.findMany({
      where: excludeDeleted({
        slug: { not: slug },
        status: 'PUBLISHED',
        OR: [
          { category: product.category },
          { concerns: { some: { concernId: { in: product.concerns.map((c) => c.concernId) } } } },
        ],
      }),
      take: 4,
      include: { badges: true, concerns: { include: { concern: true } } },
    });

    return { product: this.toDetail(product), recommended: recommended.map((p) => this.toSummary(p)) };
  }

  private buildOrderBy(sort?: ProductSort): Prisma.ProductOrderByWithRelationInput {
    switch (sort) {
      case ProductSort.Bestsellers:
        return { reviewCount: 'desc' };
      case ProductSort.New:
        return { createdAt: 'desc' };
      case ProductSort.PriceAsc:
        return { priceMinor: 'asc' };
      case ProductSort.PriceDesc:
        return { priceMinor: 'desc' };
      case ProductSort.Rating:
        return { rating: 'desc' };
      default:
        return { rating: 'desc' };
    }
  }

  private toEnumCategory(s: string): ProductCategory | undefined {
    const candidate = s.toUpperCase().replace(/-/g, '_');
    return (Object.values(ProductCategory) as string[]).includes(candidate)
      ? (candidate as ProductCategory)
      : undefined;
  }

  private async buildFacets(_where: Prisma.ProductWhereInput) {
    // Lightweight scaffold — extend with groupBy aggregations as needed.
    return {
      categories: [],
      skinTypes: [],
      skinConcerns: [],
      hairConcerns: [],
      priceRange: { min: 0, max: 5000 },
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

  private toDetail(p: any) {
    return {
      ...this.toSummary(p),
      sku: p.sku,
      size: p.size,
      isCombo: p.isCombo,
      longDescription: p.longDescription,
      gallery: p.gallery?.map((g: any) => ({ url: g.url, alt: g.alt })) ?? [],
      ingredients: p.ingredients?.map((i: any) => ({ name: i.name, benefit: i.benefit })) ?? [],
      benefits: p.benefits ?? [],
      howToUse: p.howToUse ?? [],
    };
  }
}
