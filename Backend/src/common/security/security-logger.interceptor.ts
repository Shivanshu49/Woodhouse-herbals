import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

/**
 * Structured request logger optimised for SIEM ingestion.
 *
 * Emits a single line per request as JSON with: method, path, status, duration,
 * IP, user agent, user id (if authenticated). Bodies are NEVER logged — they
 * may contain passwords, tokens, or PII.
 *
 * The interceptor also annotates slow requests (>1500 ms) and any 4xx/5xx for
 * easy alerting downstream.
 */
@Injectable()
export class SecurityLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Request');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const start = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => this.emit(req, res, start, undefined),
        error: (err) => this.emit(req, res, start, err),
      }),
    );
  }

  private emit(req: Request, res: Response, start: bigint, err: unknown) {
    const durationMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
    const status = err instanceof HttpException ? err.getStatus() : res.statusCode;

    const entry = {
      scope: 'http',
      method: req.method,
      path: this.scrubPath(req.originalUrl ?? req.url),
      status,
      durationMs,
      ip: extractIp(req),
      ua: (req.headers['user-agent'] as string | undefined)?.slice(0, 200),
      userId: req.user?.sub ?? null,
      slow: durationMs > 1500,
      err: err instanceof Error ? err.constructor.name : undefined,
    };

    if (status >= 500 || (err && !(err instanceof HttpException))) {
      this.logger.error(JSON.stringify(entry));
    } else if (status === 401 || status === 403 || status === 429) {
      this.logger.warn(JSON.stringify(entry));
    } else if (entry.slow || status >= 400) {
      this.logger.warn(JSON.stringify(entry));
    } else {
      this.logger.log(JSON.stringify(entry));
    }
  }

  /**
   * Strip query-string tokens that may show up in URLs (reset/verify links).
   * Belt-and-braces: those are POST endpoints, but defensive scrubbing here
   * prevents accidental log leaks if a copy/paste hits GET.
   */
  private scrubPath(path: string): string {
    return path.replace(/([?&](token|otp|code|key|secret)=)[^&]+/gi, '$1[redacted]');
  }
}

function extractIp(req: Request): string | undefined {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0]?.trim();
  return req.ip ?? req.socket?.remoteAddress ?? undefined;
}
