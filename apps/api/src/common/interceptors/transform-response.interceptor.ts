import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { Request, Response } from 'express'
import { API_VERSION, CONTRACT_VERSION, RESPONSE_HEADERS } from '@ehsbha/api-contracts/core'

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>()

    return next.handle().pipe(
      map(data => {
        const res = context.switchToHttp().getResponse<Response>()

        if (res.headersSent) return data

        const requestId = req.requestContext?.requestId || ''

        res.setHeader(RESPONSE_HEADERS.REQUEST_ID, requestId)
        res.setHeader(RESPONSE_HEADERS.API_VERSION, API_VERSION)
        res.setHeader(RESPONSE_HEADERS.CONTRACT_VERSION, CONTRACT_VERSION)

        const responseData = data === undefined || data === null ? { ok: true } : data
        if (res.statusCode === 204) res.status(200)
        const meta = {
          ...(isEnvelope(responseData) ? normalizeMeta(responseData.meta) : {}),
          requestId,
          serverTime: new Date().toISOString(),
          apiVersion: API_VERSION,
          contractVersion: CONTRACT_VERSION,
        }

        if (isEnvelope(responseData)) {
          return {
            ...responseData,
            meta,
          }
        }

        return {
          data: responseData,
          meta,
        }
      }),
    )
  }
}

function isEnvelope(value: unknown): value is { data: unknown; meta: unknown } {
  return typeof value === 'object' && value !== null && 'data' in value && 'meta' in value
}

function normalizeMeta(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}
