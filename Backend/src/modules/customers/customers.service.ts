import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AddressDto, UpdateProfileDto } from './dto/customers.dto';

const ADDRESS_SELECT = {
  id: true,
  fullName: true,
  phone: true,
  line1: true,
  line2: true,
  city: true,
  state: true,
  pincode: true,
  country: true,
  isDefault: true,
} as const;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      // Explicit allow-list — never return passwordHash, refresh tokens, etc.
      // googleId/passwordHash are read only to derive booleans and stripped
      // before the object leaves this method.
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        emailVerified: true,
        skinType: true,
        primaryConcerns: true,
        googleId: true,
        passwordHash: true,
        createdAt: true,
        addresses: {
          select: ADDRESS_SELECT,
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] as const,
        },
        wishlistItems: { select: { productId: true, createdAt: true } },
      },
    });
    if (!user) throw new NotFoundException();
    const { googleId, passwordHash, ...safe } = user;
    return {
      ...safe,
      hasGoogle: Boolean(googleId),
      hasPassword: Boolean(passwordHash),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.skinType !== undefined ? { skinType: dto.skinType } : {}),
          ...(dto.primaryConcerns !== undefined ? { primaryConcerns: dto.primaryConcerns } : {}),
        },
      });
    } catch (err) {
      // P2002 = unique violation — the phone belongs to another account.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('This phone number is already linked to another account.');
      }
      throw err;
    }
    return this.getProfile(userId);
  }

  // ──────────────────────────────────────────────────────────────────
  // Addresses — every operation is scoped to the caller's userId so a
  // crafted address id can never touch another user's rows (no IDOR).
  // ──────────────────────────────────────────────────────────────────

  async createAddress(userId: string, dto: AddressDto) {
    const count = await this.prisma.address.count({ where: { userId } });
    const makeDefault = dto.isDefault || count === 0;
    const address = await this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.address.create({
        data: {
          userId,
          fullName: dto.fullName,
          phone: dto.phone,
          line1: dto.line1,
          line2: dto.line2 ?? null,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          country: dto.country ?? 'IN',
          isDefault: makeDefault,
        },
        select: ADDRESS_SELECT,
      });
    });
    return address;
  }

  async updateAddress(userId: string, addressId: string, dto: AddressDto) {
    const existing = await this.prisma.address.findFirst({ where: { id: addressId, userId } });
    if (!existing) throw new NotFoundException('Address not found');
    const address = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault && !existing.isDefault) {
        await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.address.update({
        where: { id: addressId },
        data: {
          fullName: dto.fullName,
          phone: dto.phone,
          line1: dto.line1,
          line2: dto.line2 ?? null,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          country: dto.country ?? existing.country,
          isDefault: dto.isDefault ?? existing.isDefault,
        },
        select: ADDRESS_SELECT,
      });
    });
    return address;
  }

  async deleteAddress(userId: string, addressId: string): Promise<{ ok: true }> {
    const deleted = await this.prisma.address.deleteMany({ where: { id: addressId, userId } });
    if (deleted.count === 0) throw new NotFoundException('Address not found');
    // If the default was removed, promote the most recent remaining address.
    const stillDefault = await this.prisma.address.count({ where: { userId, isDefault: true } });
    if (stillDefault === 0) {
      const latest = await this.prisma.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (latest) {
        await this.prisma.address.update({ where: { id: latest.id }, data: { isDefault: true } });
      }
    }
    return { ok: true };
  }

  async setDefaultAddress(userId: string, addressId: string) {
    const existing = await this.prisma.address.findFirst({ where: { id: addressId, userId } });
    if (!existing) throw new NotFoundException('Address not found');
    await this.prisma.$transaction([
      this.prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
      this.prisma.address.update({ where: { id: addressId }, data: { isDefault: true } }),
    ]);
    return { ok: true };
  }

  async toggleWishlist(userId: string, productId: string): Promise<{ added: boolean }> {
    // Verify the product exists — prevents wishlist rows that point at junk.
    const exists = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Product not found');

    // Atomic toggle: if a row exists, delete (returns 1); otherwise create.
    const removed = await this.prisma.wishlistItem.deleteMany({
      where: { userId, productId },
    });
    if (removed.count > 0) return { added: false };
    await this.prisma.wishlistItem.create({ data: { userId, productId } });
    return { added: true };
  }
}
