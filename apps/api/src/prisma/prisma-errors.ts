import { Prisma } from '@prisma/client';

export const DATABASE_UNAVAILABLE_MESSAGE = 'Database temporarily unavailable';

const CONNECTIVITY_CODES = new Set(['P1001', 'P1002', 'P1017']);
const CONNECTIVITY_PATTERNS = [
  /can't reach database server/i,
  /server has closed the connection/i,
  /connection (?:timed out|closed|terminated)/i,
  /timed out fetching a new connection/i,
  /too many database connections/i,
];

export function isPrismaConnectivityError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && CONNECTIVITY_CODES.has(error.code)) {
    return true;
  }

  const message = getErrorMessage(error);
  return CONNECTIVITY_PATTERNS.some((pattern) => pattern.test(message));
}

export function summarizePrismaConnectivityError(error: unknown): string {
  const message = getErrorMessage(error).replace(/`[^`]+`/g, '`<redacted>`');
  const compact = message.replace(/\s+/g, ' ').trim();
  return compact || DATABASE_UNAVAILABLE_MESSAGE;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return '';
}
