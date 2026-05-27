import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { env } from '../../common/config/env';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from '../../common/utils/passwords';
import { generateOpaqueToken, hashToken } from '../../common/utils/tokens';
import { MailService } from '../../common/mail/mail.service';
import { SecurityEventsService } from '../../common/security/security-events.service';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '../../common/auth/auth-types';

interface RequestContext {
  ip?: string;
  userAgent?: string;
  sessionId?: string;
}

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly events: SecurityEventsService,
  ) {}

  // ──────────────────────────────────────────────────────────────────
  // Registration
  // ──────────────────────────────────────────────────────────────────

  async register(dto: { email: string; fullName: string; password: string }, ctx: RequestContext) {
    const strengthErrors = validatePasswordStrength(dto.password);
    if (strengthErrors.length) throw new BadRequestException(strengthErrors);

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      // Generic response: do NOT confirm whether the email is in use to a
      // stranger. The real owner will discover the existing account on login.
      await this.events.record({
        type: 'REGISTER',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        meta: { outcome: 'duplicate_email', email: dto.email },
      });
      throw new ConflictException('If the details are valid, an account will be created.');
    }

    const passwordHash = await hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        passwordHash,
        passwordChangedAt: new Date(),
      },
      select: { id: true, email: true, fullName: true, role: true, emailVerified: true },
    });

    await this.sendVerificationEmail(user.id, user.email);
    await this.events.record({
      userId: user.id,
      type: 'REGISTER',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      meta: { outcome: 'created' },
    });

    // No tokens issued until email is verified.
    return { user };
  }

  // ──────────────────────────────────────────────────────────────────
  // Login (with lockout + constant-time compare on missing accounts)
  // ──────────────────────────────────────────────────────────────────

  async login(dto: { email: string; password: string }, ctx: RequestContext) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Even on missing user, run a bcrypt compare to neutralise timing leaks.
    if (!user) {
      await verifyPassword(dto.password, DUMMY_PASSWORD_HASH);
      await this.events.record({
        type: 'LOGIN_FAILURE',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        meta: { reason: 'unknown_user', email: dto.email },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.events.record({
        userId: user.id,
        type: 'LOGIN_FAILURE',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        meta: { reason: 'locked', lockedUntil: user.lockedUntil.toISOString() },
      });
      throw new ForbiddenException('Account temporarily locked. Try again later.');
    }

    const ok = await verifyPassword(dto.password, user.passwordHash);
    if (!ok) {
      // Atomic increment — Postgres serialises the update so concurrent
      // failed attempts cannot all read the same starting value and bypass
      // the lockout threshold.
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: { increment: 1 } },
        select: { failedLoginAttempts: true },
      });
      const failed = updated.failedLoginAttempts;
      const shouldLock = failed >= env.AUTH_MAX_FAILED_ATTEMPTS;
      if (shouldLock) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            lockedUntil: new Date(Date.now() + env.AUTH_LOCKOUT_MINUTES * 60 * 1000),
          },
        });
      }
      await this.events.record({
        userId: user.id,
        type: shouldLock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILURE',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        meta: { reason: 'bad_password', attempts: failed },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.emailVerified) {
      await this.sendVerificationEmail(user.id, user.email);
      throw new ForbiddenException('Please verify your email address. We sent you a fresh link.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ctx.ip ?? null,
      },
    });

    const tokens = await this.issueTokens(user.id, user.email, user.role, randomUUID(), ctx);
    await this.claimGuestCart(user.id, ctx.sessionId);
    await this.events.record({
      userId: user.id,
      type: 'LOGIN_SUCCESS',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return {
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
      tokens,
    };
  }

  /**
   * Best-effort claim of an unowned guest cart so the user keeps the items
   * they added before signing in. If the user already has a cart, the
   * guest cart is left orphaned (a later session-merge job can fold them).
   */
  private async claimGuestCart(userId: string, sessionId?: string): Promise<void> {
    if (!sessionId) return;
    try {
      await this.prisma.cart.updateMany({
        where: { sessionId, userId: null },
        data: { userId },
      });
    } catch (err) {
      this.logger.warn(`Cart claim failed for ${userId}: ${(err as Error).message}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Refresh — token rotation with reuse detection
  // ──────────────────────────────────────────────────────────────────

  async refresh(rawRefreshToken: string, ctx: RequestContext): Promise<IssuedTokens> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(rawRefreshToken, {
        secret: env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.kind !== 'refresh') throw new UnauthorizedException('Wrong token type');

    const tokenHash = hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.userId !== payload.sub) {
      await this.events.record({
        userId: payload.sub,
        type: 'REFRESH_REUSE_DETECTED',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        meta: { reason: 'token_not_found' },
      });
      throw new UnauthorizedException('Refresh token not recognised');
    }

    if (stored.revokedAt) {
      // Reuse after rotation — burn the family.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.events.record({
        userId: stored.userId,
        type: 'REFRESH_REUSE_DETECTED',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        meta: { familyId: stored.familyId },
      });
      throw new UnauthorizedException('Session compromised — please log in again');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      select: { id: true, email: true, role: true },
    });
    if (!user) throw new UnauthorizedException();

    const newJti = randomUUID();
    const tokens = await this.issueTokens(user.id, user.email, user.role, newJti, ctx, stored.familyId);
    const replacement = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(tokens.refreshToken) },
    });
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedById: replacement?.id ?? null },
    });
    await this.events.record({
      userId: user.id,
      type: 'REFRESH_SUCCESS',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return tokens;
  }

  // ──────────────────────────────────────────────────────────────────
  // Logout — revoke this refresh family
  // ──────────────────────────────────────────────────────────────────

  async logout(rawRefreshToken: string | undefined, userId: string | undefined, ctx: RequestContext) {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
      if (stored && !stored.revokedAt) {
        await this.prisma.refreshToken.updateMany({
          where: { familyId: stored.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }
    await this.events.record({
      userId,
      type: 'LOGOUT',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // Email verification
  // ──────────────────────────────────────────────────────────────────

  async verifyEmail(rawToken: string, ctx: RequestContext) {
    const tokenHash = hashToken(rawToken);
    const record = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Verification link is invalid or has expired.');
    }
    // Atomic claim. Two concurrent requests with the same token race here:
    // only one updateMany matches (consumedAt: null) and returns count 1.
    const claimed = await this.prisma.emailVerificationToken.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new BadRequestException('Verification link is invalid or has expired.');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      }),
      // Invalidate any sibling tokens for the same user.
      this.prisma.emailVerificationToken.updateMany({
        where: { userId: record.userId, consumedAt: null, id: { not: record.id } },
        data: { consumedAt: new Date() },
      }),
    ]);
    await this.events.record({
      userId: record.userId,
      type: 'EMAIL_VERIFIED',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { ok: true };
  }

  // ──────────────────────────────────────────────────────────────────
  // Password reset
  // ──────────────────────────────────────────────────────────────────

  async requestPasswordReset(email: string, ctx: RequestContext) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const raw = generateOpaqueToken();
      const tokenHash = hashToken(raw);
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + env.PASSWORD_RESET_TTL * 1000),
          ip: ctx.ip ?? null,
        },
      });
      const url = `${env.WEB_ORIGIN.split(',')[0]}/account/reset?token=${encodeURIComponent(raw)}`;
      const msg = this.mail.buildResetEmail(url);
      await this.mail.send({ to: user.email, ...msg });
      await this.events.record({
        userId: user.id,
        type: 'PASSWORD_RESET_REQUESTED',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    } else {
      // Identical response shape regardless of account existence.
      await this.events.record({
        type: 'PASSWORD_RESET_REQUESTED',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        meta: { outcome: 'unknown_email', email },
      });
    }
    return { ok: true };
  }

  async resetPassword(dto: { token: string; password: string }, ctx: RequestContext) {
    const strengthErrors = validatePasswordStrength(dto.password);
    if (strengthErrors.length) throw new BadRequestException(strengthErrors);

    const tokenHash = hashToken(dto.token);
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Reset link is invalid or has expired.');
    }
    // Atomic claim — kills the race where two requests with the same token
    // both pass the consumedAt check above.
    const claimed = await this.prisma.passwordResetToken.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new BadRequestException('Reset link is invalid or has expired.');
    }

    const passwordHash = await hashPassword(dto.password);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, consumedAt: null, id: { not: record.id } },
        data: { consumedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.events.record({
      userId: record.userId,
      type: 'PASSWORD_RESET_COMPLETED',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { ok: true };
  }

  async changePassword(
    userId: string,
    dto: { currentPassword: string; newPassword: string },
    ctx: RequestContext,
  ) {
    const strengthErrors = validatePasswordStrength(dto.newPassword);
    if (strengthErrors.length) throw new BadRequestException(strengthErrors);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const ok = await verifyPassword(dto.currentPassword, user.passwordHash);
    if (!ok) {
      await this.events.record({
        userId,
        type: 'LOGIN_FAILURE',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        meta: { reason: 'change_password_wrong_current' },
      });
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await hashPassword(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, passwordChangedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.events.record({
      userId,
      type: 'PASSWORD_CHANGED',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { ok: true };
  }

  // ──────────────────────────────────────────────────────────────────
  // Internal helpers
  // ──────────────────────────────────────────────────────────────────

  private async sendVerificationEmail(userId: string, email: string) {
    const raw = generateOpaqueToken();
    const tokenHash = hashToken(raw);
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + env.EMAIL_VERIFICATION_TTL * 1000),
      },
    });
    const url = `${env.WEB_ORIGIN.split(',')[0]}/account/verify?token=${encodeURIComponent(raw)}`;
    const msg = this.mail.buildVerificationEmail(url);
    await this.mail.send({ to: email, ...msg });
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: AccessTokenPayload['role'],
    jti: string,
    ctx: RequestContext,
    familyId?: string,
  ): Promise<IssuedTokens> {
    const accessPayload: AccessTokenPayload = { sub: userId, email, role, jti, kind: 'access' };
    const fam = familyId ?? randomUUID();
    const refreshPayload: RefreshTokenPayload = { sub: userId, email, jti, fam, kind: 'refresh' };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: env.JWT_ACCESS_TTL,
    });
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: env.JWT_REFRESH_SECRET,
      expiresIn: env.JWT_REFRESH_TTL,
    });

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        familyId: fam,
        expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL * 1000),
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent?.slice(0, 512) ?? null,
      },
    });

    return {
      accessToken,
      refreshToken,
      accessTtlSeconds: env.JWT_ACCESS_TTL,
      refreshTtlSeconds: env.JWT_REFRESH_TTL,
    };
  }
}
