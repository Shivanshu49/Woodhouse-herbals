import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CouponKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { couponStatus } from './coupon-status';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto';

/**
 * Admin CRUD for coupons — scoped to the fields CouponsService.preview/redeem
 * actually enforces (see CreateCouponDto). This service NEVER touches the
 * redeem/preview path; it only manages coupon rows + reads redemption history.
 */
@Injectable()
export class AdminCouponsService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly LIST_INCLUDE = {
    _count: { select: { redemptions: true } },
    categories: { include: { category: { select: { id: true, name: true } } } },
  } satisfies Prisma.CouponInclude;

  async list() {
    const now = new Date();
    const coupons = await this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: AdminCouponsService.LIST_INCLUDE,
    });
    return coupons.map((c) => this.toSummary(c, now));
  }

  async getOne(id: string) {
    const now = new Date();
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        ...AdminCouponsService.LIST_INCLUDE,
        redemptions: {
          orderBy: { redeemedAt: 'desc' },
          take: 100,
          select: {
            id: true,
            discountMinor: true,
            redeemedAt: true,
            user: { select: { id: true, fullName: true, email: true } },
            order: { select: { number: true } },
          },
        },
      },
    });
    if (!coupon) throw new NotFoundException('Coupon not found.');
    const { redemptions, ...rest } = coupon;
    return {
      ...this.toSummary(rest, now),
      redemptions: redemptions.map((r) => ({
        id: r.id,
        discountMinor: r.discountMinor,
        redeemedAt: r.redeemedAt,
        orderNumber: r.order?.number ?? null,
        customerName: r.user?.fullName ?? null,
        customerEmail: r.user?.email ?? null,
      })),
    };
  }

  async create(dto: CreateCouponDto) {
    this.assertValueValid(dto.kind, dto.value, dto.maxDiscountMinor);
    try {
      const coupon = await this.prisma.coupon.create({
        data: {
          code: dto.code,
          description: dto.description ?? null,
          kind: dto.kind,
          value: dto.value,
          maxDiscountMinor: dto.kind === CouponKind.PERCENT ? dto.maxDiscountMinor ?? null : null,
          minCartMinor: dto.minCartMinor ?? 0,
          maxUses: dto.maxUses ?? null,
          perUserLimit: dto.perUserLimit ?? null,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          active: dto.active ?? true,
          categories: dto.categoryIds?.length
            ? { create: dto.categoryIds.map((id) => ({ category: { connect: { id } } })) }
            : undefined,
        },
        select: { id: true },
      });
      return coupon;
    } catch (e) {
      this.mapPrismaError(e);
    }
  }

  async update(id: string, dto: UpdateCouponDto) {
    const existing = await this.prisma.coupon.findUnique({
      where: { id },
      select: { id: true, kind: true, value: true, maxDiscountMinor: true },
    });
    if (!existing) throw new NotFoundException('Coupon not found.');

    // Validate against the MERGED (effective) kind/value so a partial edit can't
    // leave e.g. a PERCENT coupon with value 150 or a FLAT coupon carrying a cap.
    const kind = dto.kind ?? existing.kind;
    const value = dto.value ?? existing.value;
    const maxDiscountProvided = dto.maxDiscountMinor !== undefined;
    this.assertValueValid(kind, value, maxDiscountProvided ? dto.maxDiscountMinor : undefined);

    const data: Prisma.CouponUpdateInput = {};
    if (dto.description !== undefined) data.description = dto.description || null;
    if (dto.kind !== undefined) data.kind = dto.kind;
    if (dto.value !== undefined) data.value = dto.value;
    if (dto.minCartMinor !== undefined) data.minCartMinor = dto.minCartMinor;
    if (dto.maxUses !== undefined) data.maxUses = dto.maxUses;
    if (dto.perUserLimit !== undefined) data.perUserLimit = dto.perUserLimit;
    if (dto.startsAt !== undefined) data.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.expiresAt !== undefined) data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (dto.active !== undefined) data.active = dto.active;
    // A cap only exists for PERCENT; on FLAT (effective) force it null so a
    // kind switch can't leave a stale, silently-ignored cap on the row.
    if (kind === CouponKind.FLAT) data.maxDiscountMinor = null;
    else if (maxDiscountProvided) data.maxDiscountMinor = dto.maxDiscountMinor ?? null;

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.categoryIds !== undefined) {
          await tx.couponCategory.deleteMany({ where: { couponId: id } });
          if (dto.categoryIds.length) {
            await tx.couponCategory.createMany({
              data: dto.categoryIds.map((categoryId) => ({ couponId: id, categoryId })),
              skipDuplicates: true,
            });
          }
        }
        await tx.coupon.update({ where: { id }, data });
        return { id };
      });
    } catch (e) {
      this.mapPrismaError(e);
    }
  }

  async setActive(id: string, active: boolean) {
    try {
      await this.prisma.coupon.update({ where: { id }, data: { active } });
      return { id, active };
    } catch (e) {
      this.mapPrismaError(e);
    }
  }

  // ── internals ───────────────────────────────────────────────────────

  private toSummary(
    c: {
      id: string;
      code: string;
      description: string | null;
      kind: CouponKind;
      value: number;
      maxDiscountMinor: number | null;
      minCartMinor: number;
      maxUses: number | null;
      usedCount: number;
      perUserLimit: number | null;
      startsAt: Date | null;
      expiresAt: Date | null;
      active: boolean;
      createdAt: Date;
      _count: { redemptions: number };
      categories: { category: { id: string; name: string } }[];
    },
    now: Date,
  ) {
    return {
      id: c.id,
      code: c.code,
      description: c.description,
      kind: c.kind,
      value: c.value,
      maxDiscountMinor: c.maxDiscountMinor,
      minCartMinor: c.minCartMinor,
      maxUses: c.maxUses,
      usedCount: c.usedCount,
      perUserLimit: c.perUserLimit,
      startsAt: c.startsAt,
      expiresAt: c.expiresAt,
      active: c.active,
      createdAt: c.createdAt,
      redemptionCount: c._count.redemptions,
      status: couponStatus(c, now),
      categories: c.categories.map((cc) => ({ id: cc.category.id, name: cc.category.name })),
    };
  }

  private assertValueValid(kind: CouponKind, value: number, maxDiscountMinor?: number) {
    if (kind === CouponKind.PERCENT && (value < 1 || value > 100)) {
      throw new BadRequestException('A percentage coupon value must be between 1 and 100.');
    }
    if (kind === CouponKind.FLAT && maxDiscountMinor !== undefined) {
      throw new BadRequestException('A maximum-discount cap only applies to percentage coupons.');
    }
  }

  private mapPrismaError(e: unknown): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') throw new ConflictException('That coupon code is already in use.');
      if (e.code === 'P2025') throw new NotFoundException('A selected category no longer exists — reload and retry.');
    }
    throw e;
  }
}
