import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { computeDiscount, type CouponPolicy } from './coupon-pricing';

export interface PreviewInput {
  code: string;
  userId?: string;
  /**
   * Cart lines the customer is about to check out with. Each line carries
   * its product id, the live unit price (paise), and the category of the
   * product so the coupon's category-restriction rule can be evaluated.
   */
  lines: Array<{ productId: string; quantity: number; unitPriceMinor: number; category: string }>;
}

export interface PreviewResult {
  ok: boolean;
  couponId?: string;
  discountMinor: number;
  reason?: string;
}

/**
 * Coupon lifecycle:
 *   preview   → quote the discount without consuming uses (cart UI)
 *   redeem    → consume a use and write a redemption row (called from
 *               OrdersService inside the order-create transaction)
 *
 * `preview` is intentionally cheap: it does NOT take a lock or increment
 * counters. The atomicity guarantees come from `redeem`, which is the
 * only path that decrements `Coupon.usedCount` — under a conditional
 * updateMany so two concurrent redemptions cannot both win when only one
 * use remains.
 */
@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(input: PreviewInput): Promise<PreviewResult> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: input.code.toUpperCase() },
      include: {
        categories: { select: { categoryId: true } },
        concerns: { select: { concernId: true } },
      },
    });
    if (!coupon || !coupon.active) {
      return { ok: false, discountMinor: 0, reason: 'Invalid coupon' };
    }
    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      return { ok: false, discountMinor: 0, reason: 'Coupon not yet active' };
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      return { ok: false, discountMinor: 0, reason: 'Coupon has expired' };
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return { ok: false, discountMinor: 0, reason: 'Coupon has reached its usage limit' };
    }
    if (coupon.perUserLimit !== null && input.userId) {
      const used = await this.prisma.couponRedemption.count({
        where: { couponId: coupon.id, userId: input.userId },
      });
      if (used >= coupon.perUserLimit) {
        return { ok: false, discountMinor: 0, reason: 'You have already used this coupon' };
      }
    }

    const applicableSubtotalMinor = this.applicableSubtotal(coupon, input.lines);
    const subtotalMinor = input.lines.reduce(
      (acc, l) => acc + l.unitPriceMinor * l.quantity,
      0,
    );

    const policy: CouponPolicy = {
      kind: coupon.kind,
      value: coupon.value,
      maxDiscountMinor: coupon.maxDiscountMinor ?? null,
      minCartMinor: coupon.minCartMinor,
    };
    const priced = computeDiscount(policy, { subtotalMinor, applicableSubtotalMinor });
    return {
      ok: priced.ok,
      couponId: coupon.id,
      discountMinor: priced.discountMinor,
      reason: priced.reason,
    };
  }

  /**
   * Atomically redeem a coupon for an order. Must run inside the order-
   * creation transaction so a failure rolls the whole order back.
   *
   * The conditional `updateMany` is the critical concurrency guard: two
   * concurrent redemptions of the last available use both pass `preview`
   * but only one's `updateMany` matches `usedCount: { lt: maxUses }`.
   */
  async redeem(
    tx: Prisma.TransactionClient,
    args: {
      couponId: string;
      userId?: string;
      orderId: string;
      discountMinor: number;
    },
  ): Promise<void> {
    const coupon = await tx.coupon.findUnique({ where: { id: args.couponId } });
    if (!coupon) throw new NotFoundException('Coupon not found');

    if (coupon.maxUses === null) {
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      });
    } else {
      const claimed = await tx.coupon.updateMany({
        where: { id: coupon.id, usedCount: { lt: coupon.maxUses } },
        data: { usedCount: { increment: 1 } },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('Coupon has reached its usage limit');
      }
    }

    await tx.couponRedemption.create({
      data: {
        couponId: coupon.id,
        userId: args.userId,
        orderId: args.orderId,
        discountMinor: args.discountMinor,
      },
    });
  }

  /**
   * Sum of cart-line subtotals that the coupon actually applies to.
   * If the coupon has no category/concern restrictions, every line counts.
   */
  private applicableSubtotal(
    coupon: { categories: { categoryId: string }[]; concerns: { concernId: string }[] },
    lines: PreviewInput['lines'],
  ): number {
    const restricted = coupon.categories.length > 0 || coupon.concerns.length > 0;
    if (!restricted) {
      return lines.reduce((acc, l) => acc + l.unitPriceMinor * l.quantity, 0);
    }
    // TODO: when concern-restricted coupons land, plumb the concern id list
    // through `lines` (currently only category is on the line). For now we
    // honour the category restriction only.
    const allowed = new Set(coupon.categories.map((c) => c.categoryId));
    return lines
      .filter((l) => allowed.has(l.category))
      .reduce((acc, l) => acc + l.unitPriceMinor * l.quantity, 0);
  }

  // ──────────────────────────────────────────────────────────────────
  // Admin operations (RBAC-guarded by the controller)
  // ──────────────────────────────────────────────────────────────────

  async create(
    data: Prisma.CouponCreateInput,
  ): Promise<{ id: string; code: string }> {
    if (data.code) data.code = (data.code as string).toUpperCase();
    const coupon = await this.prisma.coupon.create({ data, select: { id: true, code: true } });
    return coupon;
  }

  async deactivate(id: string): Promise<void> {
    const res = await this.prisma.coupon.updateMany({
      where: { id, active: true },
      data: { active: false },
    });
    if (res.count !== 1) throw new BadRequestException('Coupon not active or not found');
  }

  list() {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { redemptions: true } },
      },
    });
  }
}
