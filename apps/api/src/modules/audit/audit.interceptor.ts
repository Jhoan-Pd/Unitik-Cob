import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AUDITED_KEY, AuditedOptions } from '../../common/decorators/audited.decorator';
import { AuditService } from './audit.service';

interface AuditableRequest {
  method: string;
  ip?: string;
  user?: AuthenticatedUser;
  params?: Record<string, string>;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  /** Services may attach previous values here before mutating (old state). */
  auditOldValues?: unknown;
}

const ACTION_BY_METHOD: Record<string, string> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

/**
 * Global traceability interceptor (Policy 3 — ISO/IEC 38500 Conformance +
 * Responsibility). Audits every successful mutating request on routes marked
 * with @Audited(), capturing user, IP, user-agent and new/old values.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.getAllAndOverride<AuditedOptions | undefined>(AUDITED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return next.handle();

    const request = context.switchToHttp().getRequest<AuditableRequest>();
    const action = options.action ?? ACTION_BY_METHOD[request.method];
    if (!action) return next.handle(); // GETs are not state changes

    return next.handle().pipe(
      // Audit completes BEFORE the response leaves: the trail is guaranteed
      // to exist for any state the caller can observe (record never throws).
      mergeMap(async (response) => {
        const entityId =
          request.params?.id ??
          request.params?.key ??
          (typeof response === 'object' && response !== null && 'id' in response
            ? String((response as { id: unknown }).id)
            : undefined);

        await this.auditService.record({
          userId: request.user?.id,
          action,
          entity: options.entity,
          entityId,
          oldValues: request.auditOldValues,
          newValues: options.omitResponse ? undefined : response,
          ipAddress: request.ip,
          userAgent: this.header(request, 'user-agent'),
        });
        return response;
      }),
    );
  }

  private header(request: AuditableRequest, name: string): string | undefined {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }
}
