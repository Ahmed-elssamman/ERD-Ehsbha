import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { createRequestContext, generateRequestId } from '../contracts/request-context'

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const inbound = req.headers['x-request-id'] as string | undefined
    req.requestContext = createRequestContext(inbound)
    res.setHeader('X-Request-Id', req.requestContext.requestId)
    next()
  }
}
