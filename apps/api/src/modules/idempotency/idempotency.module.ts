import { Module } from '@nestjs/common';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { IdempotencyRepository } from './idempotency.repository';
import { IdempotencyService } from './idempotency.service';

@Module({
  providers: [IdempotencyRepository, IdempotencyService, IdempotencyInterceptor],
  exports: [IdempotencyService, IdempotencyInterceptor],
})
export class IdempotencyModule {}
