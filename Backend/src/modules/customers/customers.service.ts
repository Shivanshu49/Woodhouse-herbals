import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      // Explicit allow-list — never select passwordHash, refresh tokens, etc.
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        emailVerified: true,
        skinType: true,
        primaryConcerns: true,
        addresses: {
          select: {
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
          },
        },
        wishlistItems: { select: { productId: true, createdAt: true } },
      },
    });
    if (!user) throw new NotFoundException();
    return user;
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
