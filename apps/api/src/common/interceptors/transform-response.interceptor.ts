import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const serverTime = new Date().toISOString();
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)) {
          return data;
        }
        return {
          data,
          meta: { serverTime },
        };
      }),
    );
  }
}
