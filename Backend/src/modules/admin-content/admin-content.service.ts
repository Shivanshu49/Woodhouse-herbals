import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { excludeDeleted } from '../../common/prisma/soft-delete';
import { dateWindowError, nextSortOrder, normalizePageSlug } from './content-helpers';
import type {
  CreateBannerDto,
  CreateFaqDto,
  CreateOfferStripItemDto,
  CreateStaticPageDto,
  CreateTestimonialDto,
  ReorderDto,
  UpdateBannerDto,
  UpdateFaqDto,
  UpdateOfferStripItemDto,
  UpdateStaticPageDto,
  UpdateTestimonialDto,
} from './dto/content.dto';

/** Map Prisma unique/not-found errors to clean HTTP codes (no app-wide filter exists). */
function mapPrismaError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') throw new ConflictException('That slug is already in use.');
    if (e.code === 'P2025') throw new NotFoundException('That item no longer exists — reload and retry.');
  }
  throw e;
}

@Injectable()
export class AdminContentService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Hero banners ────────────────────────────────────────────────────

  listBanners() {
    return this.prisma.heroBanner.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createBanner(dto: CreateBannerDto) {
    const schedule = this.resolveSchedule(dto);
    const max = await this.prisma.heroBanner.aggregate({ _max: { sortOrder: true } });
    return this.prisma.heroBanner.create({
      data: {
        eyebrow: dto.eyebrow,
        title: dto.title,
        subtitle: dto.subtitle,
        ctaLabel: dto.ctaLabel,
        ctaHref: dto.ctaHref,
        imageUrl: dto.imageUrl,
        accent: dto.accent ?? null,
        active: dto.active ?? true,
        sortOrder: nextSortOrder(max._max.sortOrder),
        ...schedule,
      },
    });
  }

  async updateBanner(id: string, dto: UpdateBannerDto) {
    const existing = await this.prisma.heroBanner.findUnique({
      where: { id },
      select: { startsAt: true, endsAt: true },
    });
    if (!existing) throw new NotFoundException('Banner not found.');
    const data: Prisma.HeroBannerUpdateInput = {};
    if (dto.eyebrow !== undefined) data.eyebrow = dto.eyebrow;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.subtitle !== undefined) data.subtitle = dto.subtitle;
    if (dto.ctaLabel !== undefined) data.ctaLabel = dto.ctaLabel;
    if (dto.ctaHref !== undefined) data.ctaHref = dto.ctaHref;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.accent !== undefined) data.accent = dto.accent || null;
    if (dto.active !== undefined) data.active = dto.active;
    Object.assign(data, this.resolveSchedule(dto, existing));
    return this.prisma.heroBanner.update({ where: { id }, data });
  }

  deleteBanner(id: string) {
    return this.hardDelete(() => this.prisma.heroBanner.delete({ where: { id } }));
  }

  reorderBanners(dto: ReorderDto) {
    return this.reorderModel(
      (id, sortOrder) => this.prisma.heroBanner.update({ where: { id }, data: { sortOrder } }),
      dto.items,
    );
  }

  // ── Offer strip ─────────────────────────────────────────────────────

  listOfferStrip() {
    return this.prisma.offerStripItem.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createOfferStripItem(dto: CreateOfferStripItemDto) {
    const schedule = this.resolveSchedule(dto);
    const max = await this.prisma.offerStripItem.aggregate({ _max: { sortOrder: true } });
    return this.prisma.offerStripItem.create({
      data: {
        headline: dto.headline,
        code: dto.code || null,
        href: dto.href || '/shop',
        active: dto.active ?? true,
        sortOrder: nextSortOrder(max._max.sortOrder),
        ...schedule,
      },
    });
  }

  async updateOfferStripItem(id: string, dto: UpdateOfferStripItemDto) {
    const existing = await this.prisma.offerStripItem.findUnique({
      where: { id },
      select: { startsAt: true, endsAt: true },
    });
    if (!existing) throw new NotFoundException('Offer strip item not found.');
    const data: Prisma.OfferStripItemUpdateInput = {};
    if (dto.headline !== undefined) data.headline = dto.headline;
    if (dto.code !== undefined) data.code = dto.code || null;
    if (dto.href !== undefined) data.href = dto.href || '/shop';
    if (dto.active !== undefined) data.active = dto.active;
    Object.assign(data, this.resolveSchedule(dto, existing));
    return this.prisma.offerStripItem.update({ where: { id }, data });
  }

  deleteOfferStripItem(id: string) {
    return this.hardDelete(() => this.prisma.offerStripItem.delete({ where: { id } }));
  }

  reorderOfferStrip(dto: ReorderDto) {
    return this.reorderModel(
      (id, sortOrder) => this.prisma.offerStripItem.update({ where: { id }, data: { sortOrder } }),
      dto.items,
    );
  }

  // ── Testimonials ────────────────────────────────────────────────────

  listTestimonials() {
    return this.prisma.testimonial.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createTestimonial(dto: CreateTestimonialDto) {
    const max = await this.prisma.testimonial.aggregate({ _max: { sortOrder: true } });
    return this.prisma.testimonial.create({
      data: {
        authorName: dto.authorName,
        authorMeta: dto.authorMeta || null,
        avatarUrl: dto.avatarUrl || null,
        rating: dto.rating ?? null,
        body: dto.body,
        active: dto.active ?? true,
        sortOrder: nextSortOrder(max._max.sortOrder),
      },
    });
  }

  async updateTestimonial(id: string, dto: UpdateTestimonialDto) {
    await this.assertExists('testimonial', id, 'Testimonial not found.');
    const data: Prisma.TestimonialUpdateInput = {};
    if (dto.authorName !== undefined) data.authorName = dto.authorName;
    if (dto.authorMeta !== undefined) data.authorMeta = dto.authorMeta || null;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl || null;
    if (dto.rating !== undefined) data.rating = dto.rating;
    if (dto.body !== undefined) data.body = dto.body;
    if (dto.active !== undefined) data.active = dto.active;
    return this.prisma.testimonial.update({ where: { id }, data });
  }

  deleteTestimonial(id: string) {
    return this.hardDelete(() => this.prisma.testimonial.delete({ where: { id } }));
  }

  reorderTestimonials(dto: ReorderDto) {
    return this.reorderModel(
      (id, sortOrder) => this.prisma.testimonial.update({ where: { id }, data: { sortOrder } }),
      dto.items,
    );
  }

  // ── FAQs ────────────────────────────────────────────────────────────

  listFaqs() {
    return this.prisma.faq.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createFaq(dto: CreateFaqDto) {
    const max = await this.prisma.faq.aggregate({ _max: { sortOrder: true } });
    return this.prisma.faq.create({
      data: {
        question: dto.question,
        answer: dto.answer,
        category: dto.category || null,
        active: dto.active ?? true,
        sortOrder: nextSortOrder(max._max.sortOrder),
      },
    });
  }

  async updateFaq(id: string, dto: UpdateFaqDto) {
    await this.assertExists('faq', id, 'FAQ not found.');
    const data: Prisma.FaqUpdateInput = {};
    if (dto.question !== undefined) data.question = dto.question;
    if (dto.answer !== undefined) data.answer = dto.answer;
    if (dto.category !== undefined) data.category = dto.category || null;
    if (dto.active !== undefined) data.active = dto.active;
    return this.prisma.faq.update({ where: { id }, data });
  }

  deleteFaq(id: string) {
    return this.hardDelete(() => this.prisma.faq.delete({ where: { id } }));
  }

  reorderFaqs(dto: ReorderDto) {
    return this.reorderModel(
      (id, sortOrder) => this.prisma.faq.update({ where: { id }, data: { sortOrder } }),
      dto.items,
    );
  }

  // ── Static pages ────────────────────────────────────────────────────

  listPages() {
    return this.prisma.staticPage.findMany({ orderBy: { slug: 'asc' } });
  }

  async getPage(id: string) {
    const page = await this.prisma.staticPage.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('Page not found.');
    return page;
  }

  async createPage(dto: CreateStaticPageDto, actorId?: string) {
    const slug = normalizePageSlug(dto.slug);
    if (!slug) throw new BadRequestException('A valid slug is required.');
    try {
      return await this.prisma.staticPage.create({
        data: {
          slug,
          title: dto.title,
          bodyHtml: dto.bodyHtml,
          metaTitle: dto.metaTitle || null,
          metaDescription: dto.metaDescription || null,
          published: dto.published ?? true,
          updatedBy: actorId ?? null,
        },
      });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async updatePage(id: string, dto: UpdateStaticPageDto, actorId?: string) {
    await this.assertExists('staticPage', id, 'Page not found.');
    const data: Prisma.StaticPageUpdateInput = { updatedBy: actorId ?? null };
    if (dto.slug !== undefined) {
      const slug = normalizePageSlug(dto.slug);
      if (!slug) throw new BadRequestException('A valid slug is required.');
      data.slug = slug;
    }
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.bodyHtml !== undefined) data.bodyHtml = dto.bodyHtml;
    if (dto.metaTitle !== undefined) data.metaTitle = dto.metaTitle || null;
    if (dto.metaDescription !== undefined) data.metaDescription = dto.metaDescription || null;
    if (dto.published !== undefined) data.published = dto.published;
    try {
      return await this.prisma.staticPage.update({ where: { id }, data });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  deletePage(id: string) {
    return this.hardDelete(() => this.prisma.staticPage.delete({ where: { id } }));
  }

  // ── Homepage sections overview (read-only) ──────────────────────────
  // The storefront homepage derives its product carousels from PRODUCT FLAGS,
  // not from a curated selection table: bestsellers = a BESTSELLER badge,
  // new arrivals = a NEW badge, combo packs = isCombo (see HomepageService).
  // This overview mirrors those exact rules so an admin can see — and jump to
  // edit — which products currently populate each homepage section. It reuses
  // the flags rather than introducing a parallel selection model.
  async homepageSections() {
    const PRODUCT_SELECT = {
      id: true,
      name: true,
      slug: true,
      thumbnailUrl: true,
      status: true,
      priceMinor: true,
    } as const;

    const [bestsellers, newArrivals, comboPacks] = await Promise.all([
      this.prisma.product.findMany({
        where: excludeDeleted({ badges: { some: { tone: 'BESTSELLER' } } }),
        select: PRODUCT_SELECT,
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.findMany({
        where: excludeDeleted({ badges: { some: { tone: 'NEW' } } }),
        select: PRODUCT_SELECT,
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.findMany({
        where: excludeDeleted({ isCombo: true }),
        select: PRODUCT_SELECT,
        orderBy: { name: 'asc' },
      }),
    ]);

    return { bestsellers, newArrivals, comboPacks };
  }

  // ── Shared internals ────────────────────────────────────────────────

  /**
   * Parse the optional [startsAt, endsAt] schedule from a create/update DTO
   * into a Prisma patch, validating the window against the (possibly merged)
   * effective bounds. On update, only keys present in the DTO are set; an empty
   * string clears a bound. The storefront doesn't enforce the window yet
   * (deferred — see storefront-wiring.md), but an inverted window is rejected.
   */
  private resolveSchedule(
    input: { startsAt?: string; endsAt?: string },
    existing?: { startsAt: Date | null; endsAt: Date | null },
  ): { startsAt?: Date | null; endsAt?: Date | null } {
    const parse = (v: string): Date => {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid date.');
      return d;
    };
    const patch: { startsAt?: Date | null; endsAt?: Date | null } = {};
    if (input.startsAt !== undefined) patch.startsAt = input.startsAt ? parse(input.startsAt) : null;
    if (input.endsAt !== undefined) patch.endsAt = input.endsAt ? parse(input.endsAt) : null;

    const effStart = patch.startsAt !== undefined ? patch.startsAt : existing?.startsAt ?? null;
    const effEnd = patch.endsAt !== undefined ? patch.endsAt : existing?.endsAt ?? null;
    const err = dateWindowError(effStart, effEnd);
    if (err) throw new BadRequestException(err);
    return patch;
  }

  /** Bulk sort-order update (drag-to-reorder), one transaction. */
  private async reorderModel(
    updater: (id: string, sortOrder: number) => Prisma.PrismaPromise<unknown>,
    items: { id: string; sortOrder: number }[],
  ) {
    try {
      await this.prisma.$transaction(items.map((it) => updater(it.id, it.sortOrder)));
    } catch (e) {
      // A stale client list (an id deleted in another tab) → P2025 → clean 404.
      mapPrismaError(e);
    }
    return { ok: true };
  }

  /** Hard-delete wrapper: content rows aren't referenced by orders, so a real
   *  delete is safe. A missing id yields P2025 → clean 404 (not 500). */
  private async hardDelete(del: () => Promise<{ id: string }>) {
    try {
      const row = await del();
      return { id: row.id, deleted: true as const };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  private async assertExists(
    model: 'testimonial' | 'faq' | 'staticPage',
    id: string,
    message: string,
  ) {
    // Narrow, explicit lookups keep Prisma's per-delegate typing intact.
    const found =
      model === 'testimonial'
        ? await this.prisma.testimonial.findUnique({ where: { id }, select: { id: true } })
        : model === 'faq'
          ? await this.prisma.faq.findUnique({ where: { id }, select: { id: true } })
          : await this.prisma.staticPage.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException(message);
  }
}
