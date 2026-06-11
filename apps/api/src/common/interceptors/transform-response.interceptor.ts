import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { Request, Response } from 'express'
import { API_VERSION, CONTRACT_VERSION, RESPONSE_HEADERS } from '@ehsbha/api-contracts/core'

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>()

    return next.handle().pipe(
      map(data => {
        const res = context.switchToHttp().getResponse<Response>()

        if (res.headersSent) return data

        const requestId = req.requestContext?.requestId || ''

        res.setHeader(RESPONSE_HEADERS.REQUEST_ID, requestId)
        res.setHeader(RESPONSE_HEADERS.API_VERSION, API_VERSION)
        res.setHeader(RESPONSE_HEADERS.CONTRACT_VERSION, CONTRACT_VERSION)

        if (data === undefined || data === null) {
          res.status(204)
          return
        }

        if (typeof data === 'object' && data !== null && 'meta' in data && 'data' in data) {
          return data
        }

        return {
          data,
          meta: {
            requestId,
            serverTime: new Date().toISOString(),
            apiVersion: API_VERSION,
            contractVersion: CONTRACT_VERSION,
          },
        }
      }),
    )
  }
}
