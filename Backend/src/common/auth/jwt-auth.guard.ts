import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { env } from '../config/env';
import { ACCESS_COOKIE, type AccessTokenPayload } from './auth-types';

/**
 * Verifies the access JWT from the `wh_at` httpOnly cookie and attaches the
 * authenticated user to req.user. Endpoints marked @Public() bypass the check.
 *
 * Important: this is a defence-in-depth guard. Even if a future bug allows an
 * untyped req.user assignment, this guard is the single place that materialises
 * an authenticated principal from a verified token.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Missing authentication');

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: env.JWT_ACCESS_SECRET,
        // Pin the accepted algorithm — never let a token dictate its own `alg`
        // (defends against alg:none and HS/RS confusion if keys ever change).
        algorithms: ['HS256'],
      });
      if (payload.kind !== 'access') throw new UnauthorizedException('Wrong token type');
      req.user = {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        tokenJti: payload.jti,
      };
      return true;
    } catch (err) {
      this.logger.warn(`Auth rejected: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid or expired authentication');
    }
  }

  private extractToken(req: Request): string | undefined {
    const fromCookie = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
    if (fromCookie) return fromCookie;
    // Bearer fallback is intentionally NOT supported here; we rely on
    // httpOnly cookies so the access token is never reachable from JS.
    return undefined;
  }
}
