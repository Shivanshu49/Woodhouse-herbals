import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
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
import { SmsService } from '../../common/sms/sms.service';
import { SecurityEventsService } from '../../common/security/security-events.service';
import { refreshTtlSecondsForRole } from './token-ttl';
import { passwordResetUrl } from './reset-url';
import { LoginBackoff } from './login-backoff';
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

/** Keep full numbers out of the audit log: `+91******1234`. */
function maskForAudit(phone: string): string {
  return phone.replace(/(\+\d{2})\d{6}(\d{4})/, '$1******$2');
}

/** First backoff step once an IP exhausts its free failed-login allowance. */
const LOGIN_BACKOFF_BASE_MS = 60_000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly sms: SmsService,
    private readonly events: SecurityEventsService,
  ) {}

  // Lazily constructed so the app boots fine without GOOGLE_CLIENT_ID.
  private googleClient?: OAuth2Client;

  // Attacker-scoped login throttle. Replaces the old victim-keyed account
  // lock, which let anyone lock a known email out of its own account by
  // guessing passwords. Keyed on the client IP; a correct login clears it.
  // Config stays env-tunable: AUTH_MAX_FAILED_ATTEMPTS = free allowance,
  // AUTH_LOCKOUT_MINUTES = cap on the exponential backoff. See login-backoff.ts.
  private readonly loginBackoff = new LoginBackoff({
    freeAttempts: env.AUTH_MAX_FAILED_ATTEMPTS,
    baseDelayMs: LOGIN_BACKOFF_BASE_MS,
    maxDelayMs: env.AUTH_LOCKOUT_MINUTES * 60 * 1000,
    idleResetMs: env.AUTH_LOCKOUT_MINUTES * 60 * 1000,
  });

  // ──────────────────────────────────────────────────────────────────
  // Registration
  // ──────────────────────────────────────────────────────────────────

  async register(dto: { email: string; fullName: string; password: string }, ctx: RequestContext) {
    const strengthErrors = validatePasswordStrength(dto.password);
    if (strengthErrors.length) throw new BadRequestException(strengthErrors);

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      // Do NOT reveal that the email is already registered — a distinct 409
      // (vs the 201 a fresh signup returned) was an account-existence oracle.
      // Return the SAME generic response as a new signup. Burn an equivalent
      // bcrypt hash first so this branch takes about as long as the create
      // path, whose ~200ms hash would otherwise be a timing oracle.
      await hashPassword(dto.password);
      await this.events.record({
        type: 'REGISTER',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        meta: { outcome: 'duplicate_email', email: dto.email },
      });
      return { ok: true };
    }

    // Without a mail provider the verification link is never delivered, which
    // would permanently lock email accounts out of login. Outside production
    // we therefore auto-verify; in production RESEND_API_KEY is expected.
    const autoVerify = env.NODE_ENV !== 'production' && !env.RESEND_API_KEY;

    const passwordHash = await hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        passwordHash,
        passwordChangedAt: new Date(),
        ...(autoVerify ? { emailVerified: true, emailVerifiedAt: new Date() } : {}),
      },
      select: { id: true, email: true, fullName: true, role: true, emailVerified: true },
    });

    if (!autoVerify) await this.sendVerificationEmail(user.id, dto.email);
    await this.events.record({
      userId: user.id,
      type: 'REGISTER',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      meta: { outcome: 'created' },
    });

    // Identical generic response to the duplicate branch — the client shows the
    // same "check your email" state either way. No tokens until verified, and
    // no user object (returning the existing owner's details would leak).
    return { ok: true };
  }

  // ──────────────────────────────────────────────────────────────────
  // Login (with lockout + constant-time compare on missing accounts)
  // ──────────────────────────────────────────────────────────────────

  async login(dto: { email: string; password: string }, ctx: RequestContext) {
    const now = Date.now();

    // Attacker-scoped gate: too many recent failures from THIS client IP are
    // refused before any account lookup or password work. Keyed on the IP, not
    // the target account, so it can never lock a real owner out of their own
    // account (the old account-lock DoS). Applied uniformly whether or not the
    // email exists, so it is not an account-existence oracle either.
    const gate = this.loginBackoff.peek(ctx.ip, now);
    if (gate.blocked) {
      await this.events.record({
        type: 'LOGIN_FAILURE',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        meta: { reason: 'ip_throttled', retryAfterMs: gate.retryAfterMs },
      });
      throw new HttpException(
        'Too many failed attempts. Please wait a moment and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Even on missing user, run a bcrypt compare to neutralise timing leaks.
    if (!user) {
      await verifyPassword(dto.password, DUMMY_PASSWORD_HASH);
      this.loginBackoff.registerFailure(ctx.ip, now);
      await this.events.record({
        type: 'LOGIN_FAILURE',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        meta: { reason: 'unknown_user', email: dto.email },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    // A deactivated (soft-deleted) account cannot log in — this is what makes the
    // admin "deactivate user" action actually revoke access. Same opaque message
    // as a bad password so it is not an enumeration/state oracle; the dummy
    // bcrypt compare keeps response timing uniform with the wrong-password path.
    if (user.deletedAt) {
      await verifyPassword(dto.password, DUMMY_PASSWORD_HASH);
      this.loginBackoff.registerFailure(ctx.ip, now);
      await this.events.record({
        userId: user.id,
        type: 'LOGIN_FAILURE',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        meta: { reason: 'deactivated' },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    // Passwordless accounts (phone-OTP / Google) still burn a bcrypt compare
    // so response timing does not reveal which accounts lack a password.
    const ok = await verifyPassword(dto.password, user.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!ok) {
      // Throttle this IP (attacker-scoped — never locks the account itself).
      this.loginBackoff.registerFailure(ctx.ip, now);
      // Per-account counter of targeting attempts — an audit signal only, NOT
      // an access-control lock (that was the removed DoS). Atomic increment so
      // concurrent failures serialise on the row.
      let attempts: number | undefined;
      try {
        const updated = await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: { increment: 1 } },
          select: { failedLoginAttempts: true },
        });
        attempts = updated.failedLoginAttempts;
      } catch (err) {
        // This counter is telemetry, not access control. A schema drift,
        // transient DB error, or deleted-race must never turn bad credentials
        // into a 500 and disclose that the account exists.
        this.logger.error(
          `Failed to increment login-failure counter for user ${user.id}: ${(err as Error).message}`,
          err instanceof Error ? err.stack : undefined,
        );
      }
      await this.events.record({
        userId: user.id,
        type: 'LOGIN_FAILURE',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        meta: { reason: 'bad_password', ...(attempts === undefined ? {} : { attempts }) },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.emailVerified) {
      await this.sendVerificationEmail(user.id, dto.email);
      throw new ForbiddenException('Please verify your email address. We sent you a fresh link.');
    }

    // Correct credentials: clear this IP's backoff (auto-unlock) and reset the
    // account's targeting counter (and any legacy lockedUntil older code set).
    this.loginBackoff.registerSuccess(ctx.ip);
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
   * Admin-surface login. Reuses the full `login` path (lockout, timing-safe
   * compares, audit events), then refuses CUSTOMER accounts with the SAME
   * message as bad credentials so this endpoint cannot be used to probe
   * which emails exist. The refresh token the shared path just minted is
   * revoked before the rejection, so no dangling session survives.
   */
  async adminLogin(dto: { email: string; password: string }, ctx: RequestContext) {
    const result = await this.login(dto, ctx);
    if (result.user.role === 'CUSTOMER') {
      await this.logout(result.tokens.refreshToken, result.user.id, ctx);
      await this.events.record({
        userId: result.user.id,
        type: 'LOGIN_FAILURE',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        meta: { reason: 'not_staff', surface: 'admin' },
      });
      throw new UnauthorizedException('Invalid email or password');
    }
    return result;
  }

  // ──────────────────────────────────────────────────────────────────
  // Phone OTP sign-in
  // ──────────────────────────────────────────────────────────────────

  async requestOtp(phone: string, ctx: RequestContext) {
    if (env.NODE_ENV === 'production' && !this.sms.isConfigured) {
      throw new ServiceUnavailableException('Phone sign-in is temporarily unavailable.');
    }

    // Per-phone flood control on top of the per-IP controller throttle, so a
    // botnet cannot burn one victim's number from many IPs.
    const windowStart = new Date(Date.now() - 15 * 60 * 1000);
    const recent = await this.prisma.phoneOtp.count({
      where: { phone, createdAt: { gt: windowStart } },
    });
    if (recent >= env.OTP_REQUESTS_PER_WINDOW) {
      throw new HttpException(
        'Too many codes requested for this number. Try again in a few minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // A fresh code invalidates all previous outstanding ones for the number.
    await this.prisma.phoneOtp.updateMany({
      where: { phone, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.phoneOtp.create({
      data: {
        phone,
        codeHash: hashToken(`${phone}:${code}`),
        expiresAt: new Date(Date.now() + env.OTP_TTL_SECONDS * 1000),
        ip: ctx.ip ?? null,
      },
    });
    await this.sms.sendOtp(phone, code);
    await this.events.record({
      type: 'LOGIN_FAILURE',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      meta: { method: 'phone_otp', stage: 'otp_requested', phone: maskForAudit(phone) },
    });

    return {
      ok: true,
      ttlSeconds: env.OTP_TTL_SECONDS,
      // Outside production the code is echoed back so the flow works without
      // an SMS provider. NEVER present in production responses.
      ...(env.NODE_ENV !== 'production' ? { devCode: code } : {}),
    };
  }

  /**
   * Validate and atomically consume the outstanding OTP for a phone number.
   * Shared by OTP login and verified phone-change. Throws 401 on any failure.
   */
  private async consumeOtp(phone: string, code: string): Promise<void> {
    const invalid = () => new UnauthorizedException('Code is invalid or has expired');

    const otp = await this.prisma.phoneOtp.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.expiresAt < new Date()) throw invalid();

    // Attempt counter increments atomically BEFORE the hash compare, so a
    // brute-force loop burns the code even when every guess is wrong.
    const bumped = await this.prisma.phoneOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    if (bumped.attempts > env.OTP_MAX_ATTEMPTS) {
      await this.prisma.phoneOtp.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      });
      throw new UnauthorizedException('Too many attempts. Request a new code.');
    }

    if (hashToken(`${phone}:${code}`) !== otp.codeHash) throw invalid();

    // Atomic claim — two parallel requests with the right code cannot both win.
    const claimed = await this.prisma.phoneOtp.updateMany({
      where: { id: otp.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== 1) throw invalid();
  }

  async verifyOtp(dto: { phone: string; code: string; fullName?: string }, ctx: RequestContext) {
    await this.consumeOtp(dto.phone, dto.code);

    let user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          fullName: dto.fullName?.trim() || 'Wood House Customer',
        },
      });
      await this.events.record({
        userId: user.id,
        type: 'REGISTER',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        meta: { method: 'phone_otp' },
      });
    }

    return this.completeSocialLogin(user, 'phone_otp', ctx);
  }

  /**
   * Verified phone change for a signed-in user. The phone is a LOGIN
   * IDENTIFIER (OTP flow), so it must never be persisted from a bare
   * profile edit — possession is proven with the same OTP machinery
   * (request via requestOtp, then this consumes the code).
   */
  async changePhone(userId: string, dto: { phone: string; code: string }, ctx: RequestContext) {
    await this.consumeOtp(dto.phone, dto.code);
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { phone: dto.phone },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('This phone number is already linked to another account.');
      }
      throw err;
    }
    await this.events.record({
      userId,
      type: 'PHONE_CHANGED',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      meta: { phone: maskForAudit(dto.phone) },
    });
    return { ok: true as const, phone: dto.phone };
  }

  // ──────────────────────────────────────────────────────────────────
  // Google sign-in
  // ──────────────────────────────────────────────────────────────────

  async googleSignIn(credential: string, ctx: RequestContext) {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new ServiceUnavailableException('Google sign-in is not configured.');
    }
    this.googleClient ??= new OAuth2Client(env.GOOGLE_CLIENT_ID);

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Google sign-in could not be verified.');
    }
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      // Unverified Google emails must not link to existing accounts — that
      // would allow account takeover by registering the victim's address.
      throw new UnauthorizedException('Google account email is not verified.');
    }
    const email = payload.email.toLowerCase();

    let user = await this.prisma.user.findUnique({ where: { googleId: payload.sub } });
    if (!user) {
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        // Link Google to the existing account. Google has verified ownership
        // of the address, which also settles our own email verification.
        //
        // Pre-hijack defence: if the local account was never email-verified,
        // it may have been registered by an attacker squatting on this
        // address (they set the password; verification is what they could
        // never complete). Marking it verified would activate that password
        // — so for unverified accounts we wipe the password and revoke every
        // outstanding session/reset token before handing it to the real
        // owner of the email.
        const wasUnverified = !byEmail.emailVerified;
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: {
            googleId: payload.sub,
            avatarUrl: byEmail.avatarUrl ?? payload.picture ?? null,
            emailVerified: true,
            emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
            ...(wasUnverified ? { passwordHash: null, passwordChangedAt: new Date() } : {}),
          },
        });
        if (wasUnverified) {
          await this.prisma.$transaction([
            this.prisma.refreshToken.updateMany({
              where: { userId: byEmail.id, revokedAt: null },
              data: { revokedAt: new Date() },
            }),
            this.prisma.passwordResetToken.updateMany({
              where: { userId: byEmail.id, consumedAt: null },
              data: { consumedAt: new Date() },
            }),
          ]);
        }
      } else {
        user = await this.prisma.user.create({
          data: {
            email,
            fullName: payload.name?.trim() || email.split('@')[0],
            googleId: payload.sub,
            avatarUrl: payload.picture ?? null,
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
        });
        await this.events.record({
          userId: user.id,
          type: 'REGISTER',
          ip: ctx.ip,
          userAgent: ctx.userAgent,
          meta: { method: 'google' },
        });
      }
    }

    return this.completeSocialLogin(user, 'google', ctx);
  }

  /** Shared tail of the OTP/Google flows: stamp login, issue cookies. */
  private async completeSocialLogin(
    user: { id: string; email: string | null; fullName: string; role: AccessTokenPayload['role']; phone: string | null; avatarUrl: string | null },
    method: 'phone_otp' | 'google',
    ctx: RequestContext,
  ) {
    // Deactivated (soft-deleted) accounts cannot sign in via ANY method — this is
    // the single choke point for Google + phone-OTP (login() guards the password
    // path). Opaque failure so it is not a state oracle.
    const live = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { deletedAt: true },
    });
    if (live?.deletedAt) {
      await this.events.record({ userId: user.id, type: 'LOGIN_FAILURE', ip: ctx.ip, userAgent: ctx.userAgent, meta: { reason: 'deactivated', method } });
      throw new UnauthorizedException('Invalid credentials');
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
      meta: { method },
    });
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
      },
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
        // Pin the algorithm — see jwt-auth.guard.ts.
        algorithms: ['HS256'],
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
      select: { id: true, email: true, role: true, deletedAt: true },
    });
    if (!user) throw new UnauthorizedException();
    // A deactivated user must not be able to refresh a live session into new
    // tokens. Burn the whole family so no rotation can resurrect access.
    if (user.deletedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Session revoked — please log in again');
    }

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
      const url = passwordResetUrl(user.role, raw, env.WEB_ORIGIN, env.ADMIN_ORIGIN);
      const msg = this.mail.buildResetEmail(url);
      // Fire-and-forget: awaiting the provider round-trip here makes the
      // hit branch measurably slower than the unknown-email branch — a timing
      // oracle for account existence. Failures are logged, never surfaced.
      void this.mail
        .send({ to: email, ...msg })
        .catch((err) => this.logger.warn(`Password reset email failed to send: ${(err as Error).message}`));
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

    if (!user.passwordHash) {
      throw new BadRequestException(
        'This account signs in with OTP or Google and has no password yet. Use “forgot password” to set one.',
      );
    }

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
    // Fire-and-forget: the send only runs when the account exists / is
    // unverified, so awaiting it would leak that state as response latency
    // (register, and login of an unverified user). Failures are logged.
    void this.mail
      .send({ to: email, ...msg })
      .catch((err) => this.logger.warn(`Verification email failed to send: ${(err as Error).message}`));
  }

  private async issueTokens(
    userId: string,
    email: string | null,
    role: AccessTokenPayload['role'],
    jti: string,
    ctx: RequestContext,
    familyId?: string,
  ): Promise<IssuedTokens> {
    // Phone-only accounts have no email; the claim is an empty string rather
    // than null so existing payload consumers keep a plain-string type.
    const accessPayload: AccessTokenPayload = { sub: userId, email: email ?? '', role, jti, kind: 'access' };
    const fam = familyId ?? randomUUID();
    const refreshPayload: RefreshTokenPayload = { sub: userId, email: email ?? '', jti, fam, kind: 'refresh' };
    const refreshTtl = refreshTtlSecondsForRole(role);

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: env.JWT_ACCESS_TTL,
    });
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: env.JWT_REFRESH_SECRET,
      expiresIn: refreshTtl,
    });

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        familyId: fam,
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent?.slice(0, 512) ?? null,
      },
    });

    return {
      accessToken,
      refreshToken,
      accessTtlSeconds: env.JWT_ACCESS_TTL,
      refreshTtlSeconds: refreshTtl,
    };
  }
}
