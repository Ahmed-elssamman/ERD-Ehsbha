import { SetMetadata } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';

export const IDEMPOTENT_OPERATION = 'platform:idempotent-operation';

export interface IdempotentOperationOptions {
  operationId: string;
  realm: 'driver' | 'admin' | 'system';
  requestSchema: ZodTypeAny;
  retentionHours?: number;
}

export const IdempotentOperation = (options: IdempotentOperationOptions) =>
  SetMetadata(IDEMPOTENT_OPERATION, options);
