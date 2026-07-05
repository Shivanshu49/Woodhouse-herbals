import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { env } from '../../common/config/env';
import { generateOpaqueToken, hashToken } from '../../common/utils/tokens';
import { passwordResetUrl } from '../auth/reset-url';

const STAFF_ROLES: readonly UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF];

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** All admin-surface users, INCLUDING deactivated ones (deletedAt set). */
  list() {
    return this.prisma.user.findMany({
      where: { role: { in: [...STAFF_ROLES] } },
      select: { id: true, email: true, fullName: true, role: true, deletedAt: true, createdAt: true },
      orderBy: [{ deletedAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Invite a staff member: creates the user with NO password and issues a
   * password-reset "invite" token; they set their own password via the returned
   * link. The account cannot log in until then (login requires a passwordHash).
   */
  async createStaff(dto: { email: string; fullName: string; role: UserRole }, _actorId: string) {
    if (!STAFF_ROLES.includes(dto.role)) {
      throw new BadRequestException('Role must be ADMIN, MANAGER, or STAFF.');
    }
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ConflictException('A user with that email already exists.');

    const user = await this.prisma.user.create({
      data: {
        email,
        fullName: dto.fullName.trim(),
        role: dto.role,
        emailVerified: true, // admin-created accounts are trusted
        emailVerifiedAt: new Date(),
      },
      select: { id: true, email: true, fullName: true, role: true },
    });

    const raw = generateOpaqueToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + env.PASSWORD_RESET_TTL * 1000),
      },
    });
    const inviteUrl = passwordResetUrl(user.role, raw, env.WEB_ORIGIN, env.ADMIN_ORIGIN);
    return { ...user, active: true, inviteUrl };
  }

  /** Change role and/or (de)activate a staff user, with lockout guards. */
  async update(id: string, dto: { role?: UserRole; active?: boolean }, actorId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, deletedAt: true },
    });
    if (!target || !STAFF_ROLES.includes(target.role)) throw new NotFoundException('Staff user not found.');
    if (dto.role !== undefined && !STAFF_ROLES.includes(dto.role)) {
      throw new BadRequestException('Role must be ADMIN, MANAGER, or STAFF.');
    }

    // You cannot lock yourself out.
    const selfDeactivate = id === actorId && dto.active === false;
    const selfDemote = id === actorId && dto.role !== undefined && dto.role !== UserRole.ADMIN && target.role === UserRole.ADMIN;
    if (selfDeactivate || selfDemote) {
      throw new ConflictException('You cannot deactivate or demote your own account.');
    }

    const demotingAdmin = target.role === UserRole.ADMIN && dto.role !== undefined && dto.role !== UserRole.ADMIN;
    const deactivatingAdmin = target.role === UserRole.ADMIN && dto.active === false && target.deletedAt === null;
    const deactivating = dto.active === false;

    const data: { role?: UserRole; deletedAt?: Date | null } = {};
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.active !== undefined) data.deletedAt = dto.active ? null : new Date();

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Re-check the last-admin invariant INSIDE a serializable tx so two
          // concurrent demotes/deactivates can't both pass the count and drop the
          // number of active admins to zero (TOCTOU).
          if (demotingAdmin || deactivatingAdmin) {
            const activeAdmins = await tx.user.count({ where: { role: UserRole.ADMIN, deletedAt: null } });
            if (activeAdmins <= 1) throw new ConflictException('Cannot remove the last active administrator.');
          }
          const updated = await tx.user.update({
            where: { id },
            data,
            select: { id: true, email: true, fullName: true, role: true, deletedAt: true },
          });
          // Deactivation must actually revoke access: kill live refresh tokens so
          // refresh() can't mint new ones (the short-lived access cookie also expires).
          if (deactivating) {
            await tx.refreshToken.updateMany({
              where: { userId: id, revokedAt: null },
              data: { revokedAt: new Date() },
            });
          }
          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
        throw new ConflictException('Another admin change happened concurrently — please retry.');
      }
      throw e;
    }
  }
}
