import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
        code = httpStatusToCode(status);
      } else if (typeof resp === 'object' && resp !== null) {
        const r = resp as Record<string, unknown>;
        code = (r.code as string) ?? httpStatusToCode(status);
        message = (r.message as string) ?? message;
        details = r.issues ?? r.details;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = mapPrismaError(exception);
      status = mapped.status;
      code = mapped.code;
      message = mapped.message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} -> ${status} ${code}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${req.method} ${req.url} -> ${status} ${code}: ${message}`);
    }

    res.status(status).json({
      error: {
        code,
        message,
        details,
      },
      meta: {
        path: req.url,
        method: req.method,
        serverTime: new Date().toISOString(),
      },
    });
  }
}

function httpStatusToCode(status: number): string {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 422: return 'UNPROCESSABLE';
    case 429: return 'RATE_LIMITED';
    default:  return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
  }
}

function mapPrismaError(err: Prisma.PrismaClientKnownRequestError): { status: number; code: string; message: string } {
  switch (err.code) {
    case 'P2002':
      return { status: 409, code: 'DUPLICATE', message: 'Resource already exists' };
    case 'P2025':
      return { status: 404, code: 'NOT_FOUND', message: 'Resource not found' };
    case 'P2003':
      return { status: 400, code: 'FOREIGN_KEY', message: 'Related resource does not exist' };
    default:
      return { status: 500, code: 'DB_ERROR', message: 'Database error' };
  }
}
