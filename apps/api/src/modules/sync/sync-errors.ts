import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getErrorDefinition, type SyncFailedResult, type SyncMutation } from '@ehsbha/api-contracts';
import { SyncMutationStatus } from '@ehsbha/shared-types';
import { isPrismaConnectivityError } from '../../prisma/prisma-errors';

export function syncFailure(mutation: SyncMutation, error: Error): SyncFailedResult {
  let code = 'INTERNAL_ERROR';
  if (isPrismaConnectivityError(error)) code = 'SERVICE_UNAVAILABLE';
  // Request validation runs before execution; schema failures here concern the produced record.
  else if (error instanceof z.ZodError) code = 'CONTRACT_VIOLATION';
  else if (error instanceof HttpException) {
    const parsed = z.object({ code: z.string() }).safeParse(error.getResponse());
    const definition = parsed.success ? getErrorDefinition(parsed.data.code) : null;
    if (definition?.realms.includes('driver')) code = definition.code;
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') code = 'CONFLICT';
    if (error.code === 'P2003' || error.code === 'P2025') code = 'NOT_FOUND';
    if (error.code === 'P2034' || error.code === 'P2028') code = 'SERVICE_UNAVAILABLE';
  }
  const definition = getErrorDefinition(code) ?? getErrorDefinition('INTERNAL_ERROR');
  let status = SyncMutationStatus.InternalError;
  if (definition?.category === 'validation') status = SyncMutationStatus.ValidationError;
  if (definition?.category === 'conflict') status = SyncMutationStatus.Conflict;
  if (definition?.category === 'not-found') status = SyncMutationStatus.NotFound;
  if (definition?.category === 'authorization' || definition?.category === 'authentication') status = SyncMutationStatus.Forbidden;
  if (definition?.category === 'transient' || definition?.category === 'throttling') status = SyncMutationStatus.RetryableError;
  return { clientMutationId: mutation.clientMutationId, kind: mutation.kind, status,
    error: { code, messageKey: definition?.messageKey ?? 'errors.internalError' } };
}
