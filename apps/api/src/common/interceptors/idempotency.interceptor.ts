import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { Observable, catchError, from, mergeMap, of, throwError } from 'rxjs';
import type { AuthUser } from '../decorators/current-user.decorator';
import {
  IDEMPOTENT_OPERATION,
  type IdempotentOperationOptions,
} from '../decorators/idempotent-operation.decorator';
import { IdempotencyService } from '../../modules/idempotency/idempotency.service';

type RequestIdentity = Request & { user?: AuthUser | { id: string } };

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly service: IdempotencyService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.getAllAndOverride<IdempotentOperationOptions>(
      IDEMPOTENT_OPERATION,
      [context.getHandler(), context.getClass()],
    );
    if (!options) return next.handle();

    const request = context.switchToHttp().getRequest<RequestIdentity>();
    const response = context.switchToHttp().getResponse<Response>();
    const keyHeader = request.headers['idempotency-key'];
    const key = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader;
    if (!key) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Idempotency-Key header is required',
      });
    }

    const parsed = options.requestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          code: issue.code,
          message: issue.message,
        })),
      });
    }
    request.body = parsed.data;

    const query = options.querySchema?.safeParse(request.query);
    if (query && !query.success) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Invalid request query' });
    const pathParameters: Record<string, string> = {};
    for (const name of options.pathParameters ?? []) {
      const value = request.params[name];
      if (typeof value !== 'string') throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Invalid resource identifier' });
      pathParameters[name] = value;
    }
    const requestFingerprint = options.querySchema || options.pathParameters
      ? { body: parsed.data as object, query: query?.data as object ?? {}, params: pathParameters }
      : parsed.data;

    const actorId = actorIdFrom(request.user);
    if (!actorId) {
      throw new BadRequestException({
        code: 'UNAUTHENTICATED',
        message: 'Authenticated actor is required for idempotency',
      });
    }

    return from(this.service.begin({
      realm: options.realm,
      actorId,
      operationId: options.operationId,
      key,
    }, requestFingerprint, options.retentionHours)).pipe(
      mergeMap((result) => {
        if (result.kind === 'replay') {
          response.status(result.response.status);
          response.setHeader('Idempotency-Replayed', 'true');
          return of(result.response.body);
        }
        return next.handle().pipe(
          mergeMap((body) => from(
            this.service.complete(result.recordId, response.statusCode, body ?? { ok: true }),
          ).pipe(mergeMap(() => of(body)))),
          catchError((error: unknown) => from(
            this.service.markRetryableFailure(result.recordId),
          ).pipe(mergeMap(() => throwError(() => error)))),
        );
      }),
    );
  }
}

function actorIdFrom(user: RequestIdentity['user']): string | null {
  if (!user) return null;
  if ('id' in user && typeof user.id === 'string') return user.id;
  if ('driverId' in user && typeof user.driverId === 'string') return user.driverId;
  if ('userId' in user && typeof user.userId === 'string') return user.userId;
  return null;
}
