import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_KEY, AuditMeta } from '../decorators';
import { AuditService } from '../../modules/audit/audit.service';
import type { AuthedRequest } from '../types/auth-context';

const SENSITIVE = /password|token|secret|code/i;

function redact(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).map(([k, v]) => [k, SENSITIVE.test(k) ? '[redacted]' : v]),
  );
}

/** Writes an audit entry after a successful request on handlers marked with @Audit(). */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMeta | undefined>(AUDIT_KEY, ctx.getHandler());
    if (!meta) return next.handle();
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();

    return next.handle().pipe(
      tap((result) => {
        const resultId = (result as { id?: string } | undefined)?.id;
        void this.audit.record({
          academyId: req.auth?.academyId ?? null,
          actorId: req.auth?.userId ?? null,
          action: meta.action,
          entity: meta.entity,
          entityId: (meta.idParam ? (req.params[meta.idParam] as string) : undefined) ?? resultId ?? null,
          metadata: { body: redact(req.body) } as never,
          ipAddress: req.ip ?? null,
        });
      }),
    );
  }
}
