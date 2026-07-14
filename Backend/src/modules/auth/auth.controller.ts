import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  GoogleAuthDto,
  LoginDto,
  PhoneChangeVerifyDto,
  RegisterDto,
  RequestOtpDto,
  ResetPasswordDto,
  VerifyEmailDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  type AuthenticatedUser,
} from '../../common/auth/auth-types';
import { env } from '../../common/config/env';

function cookieOptions(maxAgeSeconds?: number): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
    // Prod: set COOKIE_DOMAIN=.woodhouseherbals.com so the session cookies are
    // shared across the storefront and admin subdomains (admin.* + api.*).
    // Unset in dev — a Domain attribute for a public suffix would be rejected
    // for localhost, so cookies stay host-only there.
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    ...(maxAgeSeconds ? { maxAge: maxAgeSeconds * 1000 } : {}),
  };
}

function ctxFromRequest(req: Request): { ip?: string; userAgent?: string; sessionId?: string } {
  const sid = (req.cookies as Record<string, string> | undefined)?.['wh_sid'];
  return {
    ip: extractClientIp(req),
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    sessionId: typeof sid === 'string' ? sid : undefined,
  };
}

export function extractClientIp(req: Request): string | undefined {
  // Use the framework-resolved req.ip: Express derives it from X-Forwarded-For
  // while honouring the configured `trust proxy` hop count (TRUST_PROXY_HOPS),
  // which peels trusted proxies off the RIGHT of the chain. Do NOT read the
  // leftmost XFF entry directly — it is client-controlled and spoofable, which
  // would let an attacker forge the IP that keys the login backoff (M1) and
  // the audit trail. `trust proxy` must match the real chain — see env.ts.
  return req.ip ?? req.socket?.remoteAddress ?? undefined;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // 3 registrations / hour per IP — registrations are rare but bots love them.
  @Public()
  @Throttle({ default: { ttl: 60 * 60 * 1000, limit: 3 } })
  // 202 Accepted, not 201 Created: the response is identical whether or not the
  // email was new (a 201-vs-409 split leaked account existence). "We've accepted
  // your request; check your email."
  @Post('register')
  @HttpCode(202)
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, ctxFromRequest(req));
  }

  // 10 login attempts / 15 min per IP. AccountService also tracks per-user.
  @Public()
  @Throttle({ default: { ttl: 15 * 60 * 1000, limit: 10 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.login(dto, ctxFromRequest(req));
    this.setAuthCookies(res, tokens);
    return { user };
  }

  // Admin-surface login — same throttle budget as customer login. Rejects
  // CUSTOMER accounts (with an identical 401) before any cookie is set.
  @Public()
  @Throttle({ default: { ttl: 15 * 60 * 1000, limit: 10 } })
  @Post('admin-login')
  @HttpCode(200)
  async adminLogin(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.adminLogin(dto, ctxFromRequest(req));
    this.setAuthCookies(res, tokens);
    return { user };
  }

  // 6 OTP sends / 15 min per IP; the service adds a per-phone window too.
  @Public()
  @Throttle({ default: { ttl: 15 * 60 * 1000, limit: 6 } })
  @Post('otp/request')
  @HttpCode(200)
  async requestOtp(@Body() dto: RequestOtpDto, @Req() req: Request) {
    return this.auth.requestOtp(dto.phone, ctxFromRequest(req));
  }

  @Public()
  @Throttle({ default: { ttl: 15 * 60 * 1000, limit: 12 } })
  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.verifyOtp(dto, ctxFromRequest(req));
    this.setAuthCookies(res, tokens);
    return { user };
  }

  // Verified phone change for the signed-in user. Same OTP machinery as
  // login: request a code to the NEW number, then verify it here. A bare
  // profile edit can never set a phone (it's a login identifier).
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 15 * 60 * 1000, limit: 6 } })
  @Post('phone-change/request')
  @HttpCode(200)
  async requestPhoneChange(@Body() dto: RequestOtpDto, @Req() req: Request) {
    return this.auth.requestOtp(dto.phone, ctxFromRequest(req));
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 15 * 60 * 1000, limit: 12 } })
  @Post('phone-change/verify')
  @HttpCode(200)
  async verifyPhoneChange(
    @Body() dto: PhoneChangeVerifyDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.auth.changePhone(user.sub, dto, ctxFromRequest(req));
  }

  @Public()
  @Throttle({ default: { ttl: 15 * 60 * 1000, limit: 10 } })
  @Post('google')
  @HttpCode(200)
  async google(
    @Body() dto: GoogleAuthDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.googleSignIn(dto.credential, ctxFromRequest(req));
    this.setAuthCookies(res, tokens);
    return { user };
  }

  @Public()
  @Throttle({ default: { ttl: 60 * 1000, limit: 30 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (!raw) throw new UnauthorizedException('Missing refresh token');
    const tokens = await this.auth.refresh(raw, ctxFromRequest(req));
    this.setAuthCookies(res, tokens);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    const userId = req.user?.sub;
    await this.auth.logout(raw, userId, ctxFromRequest(req));
    res.clearCookie(ACCESS_COOKIE, cookieOptions());
    // wh_rt was set with path '/api/auth' — clearCookie must use the SAME path
    // or the browser keeps the (now revoked) cookie. RFC 6265 matches on path.
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), path: '/api/auth' });
  }

  @Public()
  @Throttle({ default: { ttl: 60 * 1000, limit: 20 } })
  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    return this.auth.verifyEmail(dto.token, ctxFromRequest(req));
  }

  // 3 / 15 min per IP — generous enough for typos, stingy enough to slow enumeration.
  @Public()
  @Throttle({ default: { ttl: 15 * 60 * 1000, limit: 3 } })
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.auth.requestPasswordReset(dto.email, ctxFromRequest(req));
  }

  @Public()
  @Throttle({ default: { ttl: 15 * 60 * 1000, limit: 5 } })
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.auth.resetPassword(dto, ctxFromRequest(req));
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 15 * 60 * 1000, limit: 5 } })
  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.changePassword(user.sub, dto, ctxFromRequest(req));
    // Force the client to re-authenticate by clearing cookies. wh_rt must be
    // cleared at its set path '/api/auth' or the browser retains it.
    res.clearCookie(ACCESS_COOKIE, cookieOptions());
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), path: '/api/auth' });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return { id: user.sub, email: user.email, role: user.role };
  }

  // ──────────────────────────────────────────────────────────────────

  private setAuthCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string; accessTtlSeconds: number; refreshTtlSeconds: number },
  ) {
    res.cookie(ACCESS_COOKIE, tokens.accessToken, cookieOptions(tokens.accessTtlSeconds));
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...cookieOptions(tokens.refreshTtlSeconds),
      // Refresh cookie scoped to /api/auth to limit blast radius — every other
      // endpoint only sees the short-lived access cookie.
      path: '/api/auth',
    });
  }
}
