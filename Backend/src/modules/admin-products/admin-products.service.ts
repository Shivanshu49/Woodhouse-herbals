import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryReason, Prisma, ProductStatus, StockStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { env } from '../../common/config/env';
import { pageArgs } from '../../common/dto/pagination.dto';
import { buildAdminProductWhere } from './admin-product-where';
import { AdminProductSort, ListAdminProductsDto } from './dto/list-admin-products.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { BulkProductsDto } from './dto/bulk-products.dto';
import { resolveBulkAction } from './bulk-action';

/** Admin list rows — deliberately thin; the detail view uses FULL_INCLUDE. */
const SUMMARY_SELECT = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  category: true,
  priceMinor: true,
  compareAtPriceMinor: true,
  stockQty: true,
  inStock: true,
  status: true,
  featured: true,
  thumbnailUrl: true,
  thumbnailAlt: true,
  deletedAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

const FULL_INCLUDE = {
  gallery: { orderBy: { sortOrder: 'asc' } },
  ingredients: true,
  benefitItems: true,
  badges: true,
  concerns: { include: { concern: true } },
  categoryLinks: { include: { category: true } },
  recommendations: {
    include: {
      targetProduct: { select: { id: true, name: true, slug: true, thumbnailUrl: true } },
    },
  },
} satisfies Prisma.ProductInclude;

@Injectable()
export class AdminProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async adminList(dto: ListAdminProductsDto) {
    const where = buildAdminProductWhere({
      q: dto.q,
      status: dto.status,
      category: dto.category,
      stock: dto.stock,
      priceMin: dto.priceMin,
      priceMax: dto.priceMax,
      deleted: dto.deleted,
    });
    const orderBy = this.buildOrderBy(dto.sort);
    const { skip, take, page, perPage } = pageArgs(dto);

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({ where, orderBy, skip, take, select: SUMMARY_SELECT }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, page, perPage };
  }

  async adminGetById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: FULL_INCLUDE,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async slugCheck(slug: string, excludeId?: string): Promise<{ available: boolean }> {
    const hit = await this.prisma.product.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    return { available: !hit };
  }

  async create(dto: CreateProductDto, actorId: string) {
    const clash = await this.prisma.product.findFirst({
      where: { OR: [{ slug: dto.slug }, { sku: dto.sku }] },
      select: { id: true },
    });
    if (clash) throw new ConflictException('A product with this slug or SKU already exists.');

    const stockQty = dto.stockQty ?? 0;
    // De-dupe so a caller passing the same id twice doesn't hit a
    // composite-PK P2002 on the nested create.
    const concernIds = dto.concernIds?.length ? [...new Set(dto.concernIds)] : dto.concernIds;
    const categoryIds = dto.categoryIds?.length ? [...new Set(dto.categoryIds)] : dto.categoryIds;

    return this.prisma.$transaction(
      async (tx) => {
      const product = await tx.product.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          sku: dto.sku,
          barcode: dto.barcode,
          brand: dto.brand ?? 'Wood House Herbals',
          shortDescription: dto.shortDescription,
          longDescription: dto.longDescription,
          category: dto.category,
          size: dto.size,
          isCombo: dto.isCombo ?? false,
          videoUrl: dto.videoUrl,
          priceMinor: dto.priceMinor,
          compareAtPriceMinor: dto.compareAtPriceMinor,
          costPriceMinor: dto.costPriceMinor,
          gstRate: dto.gstRate,
          hsnCode: dto.hsnCode,
          saleStartsAt: dto.saleStartsAt ? new Date(dto.saleStartsAt) : undefined,
          saleEndsAt: dto.saleEndsAt ? new Date(dto.saleEndsAt) : undefined,
          stockQty,
          lowStockThreshold: dto.lowStockThreshold,
          allowBackorder: dto.allowBackorder,
          trackInventory: dto.trackInventory,
          inStock: stockQty > 0,
          stockStatus: stockQty > 0 ? StockStatus.IN_STOCK : StockStatus.OUT_OF_STOCK,
          thumbnailUrl: dto.thumbnailUrl,
          thumbnailAlt: dto.thumbnailAlt,
          tags: dto.tags ?? [],
          howToUse: dto.howToUse ?? [],
          benefits: dto.benefits ?? [],
          skinTypes: dto.skinTypes ?? [],
          inciText: dto.inciText,
          parabenFree: dto.parabenFree,
          sulfateFree: dto.sulfateFree,
          crueltyFree: dto.crueltyFree,
          vegan: dto.vegan,
          alcoholFree: dto.alcoholFree,
          usageFrequency: dto.usageFrequency,
          recommendedTime: dto.recommendedTime,
          metaTitle: dto.metaTitle,
          metaDescription: dto.metaDescription,
          focusKeyword: dto.focusKeyword,
          ogImageUrl: dto.ogImageUrl,
          weightGrams: dto.weightGrams,
          lengthCm: dto.lengthCm,
          widthCm: dto.widthCm,
          heightCm: dto.heightCm,
          shippingClass: dto.shippingClass,
          freeShipping: dto.freeShipping,
          status: dto.status ?? ProductStatus.PUBLISHED,
          publishAt: dto.publishAt ? new Date(dto.publishAt) : undefined,
          featured: dto.featured,
          gallery: dto.gallery?.length
            ? {
                create: dto.gallery.map((g) => ({
                  url: g.url,
                  alt: g.alt,
                  width: g.width,
                  height: g.height,
                  sortOrder: g.sortOrder ?? 0,
                })),
              }
            : undefined,
          ingredients: dto.ingredients?.length
            ? {
                create: dto.ingredients.map((i) => ({
                  name: i.name,
                  benefit: i.benefit,
                  iconUrl: i.iconUrl,
                  sortOrder: i.sortOrder ?? 0,
                })),
              }
            : undefined,
          benefitItems: dto.benefitItems?.length
            ? {
                create: dto.benefitItems.map((b) => ({
                  text: b.text,
                  iconUrl: b.iconUrl,
                  sortOrder: b.sortOrder ?? 0,
                })),
              }
            : undefined,
          badges: dto.badges?.length
            ? { create: dto.badges.map((b) => ({ label: b.label, tone: b.tone })) }
            : undefined,
          concerns: concernIds?.length
            ? { create: concernIds.map((id) => ({ concern: { connect: { id } } })) }
            : undefined,
          // Keep the denormalized primary-category FK in lockstep with the
          // primary link (category-scoped coupons + order snapshots read it).
          categoryRefId: categoryIds?.length ? categoryIds[0] : undefined,
          categoryLinks: categoryIds?.length
            ? {
                create: categoryIds.map((id, i) => ({
                  category: { connect: { id } },
                  isPrimary: i === 0,
                })),
              }
            : undefined,
          recommendations: dto.recommendations?.length
            ? {
                create: dto.recommendations.map((r) => ({
                  targetProduct: { connect: { id: r.targetProductId } },
                  kind: r.kind ?? 'RELATED',
                  score: r.score ?? 0,
                })),
              }
            : undefined,
        },
        include: FULL_INCLUDE,
      });

      // A just-created product has no prior stock and no concurrent writers
      // racing it, so this direct movement row is correct; it is NOT a
      // substitute for InventoryService.adjust, which mid-life stock edits
      // must keep using for its CAS guard against concurrent updates.
      if (stockQty > 0) {
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            previousQty: 0,
            newQty: stockQty,
            delta: stockQty,
            reason: InventoryReason.INITIAL_SEED,
            actorId,
            note: 'Initial stock on product creation',
          },
        });
      }

      return product;
      },
      { timeout: env.ADMIN_WRITE_TX_TIMEOUT_MS },
    );
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Product not found');

    if (dto.slug !== undefined || dto.sku !== undefined) {
      const or: Prisma.ProductWhereInput[] = [];
      if (dto.slug !== undefined) or.push({ slug: dto.slug });
      if (dto.sku !== undefined) or.push({ sku: dto.sku });
      const clash = await this.prisma.product.findFirst({
        where: { id: { not: id }, OR: or },
        select: { id: true },
      });
      if (clash) throw new ConflictException('A product with this slug or SKU already exists.');
    }

    await this.prisma.$transaction(
      async (tx) => {
        // Nested collections are replace-all: wipe then recreate only when
        // the caller actually sent that array (undefined means "leave
        // untouched").
        if (dto.gallery !== undefined) await tx.productImage.deleteMany({ where: { productId: id } });
        if (dto.ingredients !== undefined) await tx.ingredient.deleteMany({ where: { productId: id } });
        if (dto.benefitItems !== undefined) await tx.productBenefit.deleteMany({ where: { productId: id } });
        if (dto.badges !== undefined) await tx.productBadge.deleteMany({ where: { productId: id } });
        if (dto.concernIds !== undefined) await tx.productConcern.deleteMany({ where: { productId: id } });
        if (dto.categoryIds !== undefined) {
          await tx.productCategoryLink.deleteMany({ where: { productId: id } });
        }
        if (dto.recommendations !== undefined) {
          await tx.recommendation.deleteMany({ where: { sourceProductId: id } });
        }

        await tx.product.update({
          where: { id },
          data: this.buildUpdateData(dto),
        });
      },
      { timeout: env.ADMIN_WRITE_TX_TIMEOUT_MS },
    );

    return this.adminGetById(id);
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Product not found');
    await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(id: string): Promise<void> {
    const existing = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Product not found');
    await this.prisma.product.update({ where: { id }, data: { deletedAt: null } });
  }

  async bulk(dto: BulkProductsDto): Promise<{ updated: number }> {
    const resolved = resolveBulkAction(dto.action, dto.categoryId, new Date());

    await this.prisma.$transaction(
      async (tx) => {
        if (resolved.kind === 'status') {
          await tx.product.updateMany({
            where: { id: { in: dto.ids } },
            data: { status: resolved.status },
          });
        } else if (resolved.kind === 'soft-delete') {
          await tx.product.updateMany({
            where: { id: { in: dto.ids } },
            data: { deletedAt: resolved.deletedAt },
          });
        } else {
          const { categoryId } = resolved;
          await tx.product.updateMany({
            where: { id: { in: dto.ids } },
            data: { categoryRefId: categoryId },
          });
          for (const productId of dto.ids) {
            await tx.productCategoryLink.upsert({
              where: { productId_categoryId: { productId, categoryId } },
              create: { productId, categoryId, isPrimary: true },
              update: { isPrimary: true },
            });
          }
          // Only one category link may be primary per product — demote any
          // stale primary links across all selected ids in a single call
          // rather than per-id inside the loop above.
          await tx.productCategoryLink.updateMany({
            where: { productId: { in: dto.ids }, categoryId: { not: categoryId } },
            data: { isPrimary: false },
          });
        }
      },
      { timeout: env.ADMIN_WRITE_TX_TIMEOUT_MS },
    );

    return { updated: dto.ids.length };
  }

  private buildOrderBy(sort?: AdminProductSort): Prisma.ProductOrderByWithRelationInput {
    switch (sort) {
      case AdminProductSort.Oldest:
        return { createdAt: 'asc' };
      case AdminProductSort.PriceAsc:
        return { priceMinor: 'asc' };
      case AdminProductSort.PriceDesc:
        return { priceMinor: 'desc' };
      case AdminProductSort.StockAsc:
        return { stockQty: 'asc' };
      case AdminProductSort.StockDesc:
        return { stockQty: 'desc' };
      case AdminProductSort.Name:
        return { name: 'asc' };
      case AdminProductSort.Newest:
      default:
        return { createdAt: 'desc' };
    }
  }

  /**
   * Builds the scalar/array/nested-write payload for an update from only
   * the keys the caller actually sent. Deliberately never touches
   * stockQty, rating, or reviewCount — UpdateProductDto cannot carry them,
   * so there is nothing here to forward even by accident.
   */
  private buildUpdateData(dto: UpdateProductDto): Prisma.ProductUpdateInput {
    const data: Prisma.ProductUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.sku !== undefined) data.sku = dto.sku;
    if (dto.barcode !== undefined) data.barcode = dto.barcode;
    if (dto.brand !== undefined) data.brand = dto.brand;
    if (dto.shortDescription !== undefined) data.shortDescription = dto.shortDescription;
    if (dto.longDescription !== undefined) data.longDescription = dto.longDescription;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.size !== undefined) data.size = dto.size;
    if (dto.isCombo !== undefined) data.isCombo = dto.isCombo;
    if (dto.videoUrl !== undefined) data.videoUrl = dto.videoUrl;
    if (dto.priceMinor !== undefined) data.priceMinor = dto.priceMinor;
    if (dto.compareAtPriceMinor !== undefined) data.compareAtPriceMinor = dto.compareAtPriceMinor;
    if (dto.costPriceMinor !== undefined) data.costPriceMinor = dto.costPriceMinor;
    if (dto.gstRate !== undefined) data.gstRate = dto.gstRate;
    if (dto.hsnCode !== undefined) data.hsnCode = dto.hsnCode;
    if (dto.saleStartsAt !== undefined) data.saleStartsAt = new Date(dto.saleStartsAt);
    if (dto.saleEndsAt !== undefined) data.saleEndsAt = new Date(dto.saleEndsAt);
    if (dto.lowStockThreshold !== undefined) data.lowStockThreshold = dto.lowStockThreshold;
    if (dto.allowBackorder !== undefined) data.allowBackorder = dto.allowBackorder;
    if (dto.trackInventory !== undefined) data.trackInventory = dto.trackInventory;
    if (dto.featured !== undefined) data.featured = dto.featured;
    if (dto.thumbnailUrl !== undefined) data.thumbnailUrl = dto.thumbnailUrl;
    if (dto.thumbnailAlt !== undefined) data.thumbnailAlt = dto.thumbnailAlt;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.howToUse !== undefined) data.howToUse = dto.howToUse;
    if (dto.benefits !== undefined) data.benefits = dto.benefits;
    if (dto.skinTypes !== undefined) data.skinTypes = dto.skinTypes;
    if (dto.inciText !== undefined) data.inciText = dto.inciText;
    if (dto.parabenFree !== undefined) data.parabenFree = dto.parabenFree;
    if (dto.sulfateFree !== undefined) data.sulfateFree = dto.sulfateFree;
    if (dto.crueltyFree !== undefined) data.crueltyFree = dto.crueltyFree;
    if (dto.vegan !== undefined) data.vegan = dto.vegan;
    if (dto.alcoholFree !== undefined) data.alcoholFree = dto.alcoholFree;
    if (dto.usageFrequency !== undefined) data.usageFrequency = dto.usageFrequency;
    if (dto.recommendedTime !== undefined) data.recommendedTime = dto.recommendedTime;
    if (dto.metaTitle !== undefined) data.metaTitle = dto.metaTitle;
    if (dto.metaDescription !== undefined) data.metaDescription = dto.metaDescription;
    if (dto.focusKeyword !== undefined) data.focusKeyword = dto.focusKeyword;
    if (dto.ogImageUrl !== undefined) data.ogImageUrl = dto.ogImageUrl;
    if (dto.weightGrams !== undefined) data.weightGrams = dto.weightGrams;
    if (dto.lengthCm !== undefined) data.lengthCm = dto.lengthCm;
    if (dto.widthCm !== undefined) data.widthCm = dto.widthCm;
    if (dto.heightCm !== undefined) data.heightCm = dto.heightCm;
    if (dto.shippingClass !== undefined) data.shippingClass = dto.shippingClass;
    if (dto.freeShipping !== undefined) data.freeShipping = dto.freeShipping;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.publishAt !== undefined) data.publishAt = new Date(dto.publishAt);

    if (dto.gallery !== undefined) {
      data.gallery = {
        create: dto.gallery.map((g) => ({
          url: g.url,
          alt: g.alt,
          width: g.width,
          height: g.height,
          sortOrder: g.sortOrder ?? 0,
        })),
      };
    }
    if (dto.ingredients !== undefined) {
      data.ingredients = {
        create: dto.ingredients.map((i) => ({
          name: i.name,
          benefit: i.benefit,
          iconUrl: i.iconUrl,
          sortOrder: i.sortOrder ?? 0,
        })),
      };
    }
    if (dto.benefitItems !== undefined) {
      data.benefitItems = {
        create: dto.benefitItems.map((b) => ({
          text: b.text,
          iconUrl: b.iconUrl,
          sortOrder: b.sortOrder ?? 0,
        })),
      };
    }
    if (dto.badges !== undefined) {
      data.badges = { create: dto.badges.map((b) => ({ label: b.label, tone: b.tone })) };
    }
    if (dto.concernIds !== undefined) {
      // De-dupe so a caller passing the same id twice doesn't hit a
      // composite-PK P2002 on the nested create.
      const concernIds = [...new Set(dto.concernIds)];
      data.concerns = { create: concernIds.map((cid) => ({ concern: { connect: { id: cid } } })) };
    }
    if (dto.categoryIds !== undefined) {
      const categoryIds = [...new Set(dto.categoryIds)];
      // Keep the denormalized primary-category FK in lockstep with the links.
      data.categoryRef = categoryIds.length ? { connect: { id: categoryIds[0] } } : { disconnect: true };
      data.categoryLinks = {
        create: categoryIds.map((cid, i) => ({
          category: { connect: { id: cid } },
          isPrimary: i === 0,
        })),
      };
    }
    if (dto.recommendations !== undefined) {
      data.recommendations = {
        create: dto.recommendations.map((r) => ({
          targetProduct: { connect: { id: r.targetProductId } },
          kind: r.kind ?? 'RELATED',
          score: r.score ?? 0,
        })),
      };
    }

    return data;
  }
}
