import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

export interface TripMutationError { code: string; message: string }
export function classifyTripError(error: Error): TripMutationError {
  let code = 'INTERNAL_ERROR';
  if (error instanceof NotFoundException) code = 'NOT_FOUND';
  else if (error instanceof ConflictException || error instanceof BadRequestException) {
    const parsed = z.object({ code: z.string() }).safeParse(error.getResponse());
    code = parsed.success ? parsed.data.code : error instanceof ConflictException ? 'CONFLICT' : 'VALIDATION_ERROR';
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') code = 'CONFLICT';
    if (error.code === 'P2025' || error.code === 'P2003') code = 'NOT_FOUND';
  }
  return { code, message: code };
}
