import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildCategoryTree, wouldCycle } from './category-tree';
import { CreateCategoryDto, ReorderCategoriesDto, UpdateCategoryDto } from './dto/category.dto';

const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  imageUrl: true,
  sortOrder: true,
  isActive: true,
  parentId: true,
} as const;

@Injectable()
export class AdminCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** All non-deleted categories as a sorted tree, each with its live product count. */
  async list() {
    const [cats, counts] = await Promise.all([
      this.prisma.category.findMany({ where: { deletedAt: null }, select: SELECT, orderBy: { sortOrder: 'asc' } }),
      this.prisma.product.groupBy({
        by: ['categoryRefId'],
        where: { deletedAt: null, categoryRefId: { not: null } },
        _count: true,
      }),
    ]);
    const countBy = new Map(counts.map((c) => [c.categoryRefId as string, c._count]));
    const withCounts = cats.map((c) => ({ ...c, productCount: countBy.get(c.id) ?? 0 }));
    return buildCategoryTree(withCounts);
  }

  async slugCheck(slug: string, excludeId?: string): Promise<{ available: boolean }> {
    const existing = await this.prisma.category.findFirst({
      where: { slug: slugify(slug), ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    return { available: !existing };
  }

  async create(dto: CreateCategoryDto) {
    const slug = slugify(dto.slug || dto.name);
    if (!slug) throw new BadRequestException('A slug is required.');
    if ((await this.slugCheck(slug)).available === false) {
      throw new ConflictException('That slug is already in use.');
    }
    if (dto.parentId) await this.assertParentExists(dto.parentId);
    const siblingMax = await this.prisma.category.aggregate({
      where: { parentId: dto.parentId ?? null, deletedAt: null },
      _max: { sortOrder: true },
    });
    return this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description ?? null,
        imageUrl: dto.imageUrl ?? null,
        parentId: dto.parentId ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: (siblingMax._max.sortOrder ?? 0) + 1,
      },
      select: SELECT,
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const cat = await this.prisma.category.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!cat) throw new NotFoundException('Category not found.');

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description || null;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl || null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.slug !== undefined) {
      const slug = slugify(dto.slug);
      if (!slug) throw new BadRequestException('A slug is required.');
      if ((await this.slugCheck(slug, id)).available === false) throw new ConflictException('That slug is already in use.');
      data.slug = slug;
    }
    if (dto.parentId !== undefined) {
      if (dto.parentId) {
        await this.assertParentExists(dto.parentId);
        const flat = await this.prisma.category.findMany({ where: { deletedAt: null }, select: { id: true, parentId: true, sortOrder: true } });
        if (wouldCycle(flat, id, dto.parentId)) {
          throw new BadRequestException('A category cannot be moved under itself or one of its descendants.');
        }
      }
      data.parentId = dto.parentId || null;
    }
    return this.prisma.category.update({ where: { id }, data, select: SELECT });
  }

  /** Bulk sort-order update (drag-to-reorder), one transaction. */
  async reorder(dto: ReorderCategoriesDto) {
    await this.prisma.$transaction(
      dto.items.map((it) => this.prisma.category.update({ where: { id: it.id }, data: { sortOrder: it.sortOrder } })),
    );
    return { ok: true };
  }

  /**
   * Soft-delete — BLOCKED if any live product (primary or M2M link) or any live
   * sub-category still points at this category, so nothing is silently orphaned.
   */
  async remove(id: string) {
    const cat = await this.prisma.category.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!cat) throw new NotFoundException('Category not found.');

    const products = await this.prisma.product.count({
      where: { deletedAt: null, OR: [{ categoryRefId: id }, { categoryLinks: { some: { categoryId: id } } }] },
    });
    if (products > 0) {
      throw new ConflictException(
        `This category still has ${products} product${products === 1 ? '' : 's'}. Reassign or remove them before deleting the category.`,
      );
    }
    const children = await this.prisma.category.count({ where: { parentId: id, deletedAt: null } });
    if (children > 0) {
      throw new ConflictException(
        `This category has ${children} sub-categor${children === 1 ? 'y' : 'ies'}. Move or delete them first.`,
      );
    }
    await this.prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }

  private async assertParentExists(parentId: string) {
    const parent = await this.prisma.category.findFirst({ where: { id: parentId, deletedAt: null }, select: { id: true } });
    if (!parent) throw new BadRequestException('Parent category not found.');
  }
}
