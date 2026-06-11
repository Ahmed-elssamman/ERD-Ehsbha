import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { Request, Response } from 'express'
import { API_VERSION, CONTRACT_VERSION, GOVERNED_ERROR_REGISTRY, normalizeErrorCode, getErrorDefinition, FieldIssue } from '@ehsbha/api-contracts/core'

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const requestId = request.requestContext?.requestId || generateFallbackId()

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR
    let code = 'INTERNAL_ERROR'
    let message = 'An unexpected error occurred'
    let details: FieldIssue[] | undefined

    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus()
      const exResponse = exception.getResponse()

      if (typeof exResponse === 'object' && exResponse !== null) {
        const exObj = exResponse as Record<string, unknown>
        code = (exObj.code as string) || codeFromHttpStatus(httpStatus)
        message = (exObj.message as string) || exception.message
        if (Array.isArray(exObj.details)) {
          details = exObj.details.map((d: Record<string, unknown>) => ({
            path: String(d.path || ''),
            code: String(d.code || ''),
            message: String(d.message || ''),
          }))
        }
      } else {
        message = typeof exResponse === 'string' ? exResponse : exception.message
        code = codeFromHttpStatus(httpStatus)
      }
    }

    const normalizedCode = normalizeErrorCode(code)
    const definition = getErrorDefinition(normalizedCode)

    if (definition) {
      httpStatus = definition.httpStatus
    }

    if (normalizedCode === 'INTERNAL_ERROR' || normalizedCode === 'CONTRACT_VIOLATION') {
      const safeMessage = message !== 'An unexpected error occurred' && normalizedCode !== 'INTERNAL_ERROR'
        ? message
        : 'An unexpected error occurred'
      response.status(httpStatus).json({
        error: {
          code: normalizedCode,
          message: safeMessage,
          messageKey: definition?.messageKey || null,
        },
        meta: {
          requestId,
          serverTime: new Date().toISOString(),
          apiVersion: API_VERSION,
          contractVersion: CONTRACT_VERSION,
        },
      })
      return
    }

    response.status(httpStatus).json({
      error: {
        code: normalizedCode,
        message,
        messageKey: definition?.messageKey || null,
        ...(details ? { details } : {}),
      },
      meta: {
        requestId,
        serverTime: new Date().toISOString(),
        apiVersion: API_VERSION,
        contractVersion: CONTRACT_VERSION,
      },
    })
  }
}

function generateFallbackId(): string {
  return `fallback-${Date.now().toString(36)}`
}

function codeFromHttpStatus(status: number): string {
  const map: Record<number, string> = {
    400: 'VALIDATION_ERROR',
    401: 'UNAUTHENTICATED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
    502: 'CONTRACT_VIOLATION',
    503: 'SERVICE_UNAVAILABLE',
  }
  return map[status] || 'INTERNAL_ERROR'
}
