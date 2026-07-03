import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';
import { AuditService } from './audit.service';
import { deriveAuditAction, deriveEntityType } from './audit-action';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Attach with @UseInterceptors(AdminAuditInterceptor) on every /admin
 * controller. Records one AdminAuditLog row per SUCCESSFUL mutating request
 * (GETs and failed requests are not audited). The response body is stored
 * as `after`; services that can produce cheap `before` snapshots may call
 * AuditService.record directly instead and skip the interceptor's row by
 * keeping their handler names distinct.
 */
@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!MUTATING.has(req.method)) return next.handle();

    const action = deriveAuditAction(ctx.getClass().name, ctx.getHandler().name);
    const entityType = deriveEntityType(ctx.getClass().name);
    const params = req.params as Record<string, string | undefined>;

    return next.handle().pipe(
      tap((result) => {
        void this.audit.record({
          actorId: req.user?.sub,
          action,
          entityType,
          entityId: params.id ?? params.number ?? params.productId,
          after: result,
          ip: req.ip,
          userAgent: req.headers['user-agent'] as string | undefined,
        });
      }),
    );
  }
}
