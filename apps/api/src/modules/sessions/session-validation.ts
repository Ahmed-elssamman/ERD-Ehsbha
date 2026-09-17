import { BadRequestException, ConflictException } from '@nestjs/common';
import { type Session } from '@prisma/client';
import { MAX_RECORDED_WORK_INTERVAL_MS } from '@ehsbha/api-contracts';

const CLOCK_SKEW_MS = 60_000;
export function assertRecordedSessionTime(value: Date): void {
  if (!Number.isFinite(value.getTime()) || value.getTime() > Date.now() + CLOCK_SKEW_MS) throw new BadRequestException({ code: 'VALIDATION_ERROR' });
}
export function assertSessionInterval(startedAt: Date, endedAt: Date): void {
  assertRecordedSessionTime(startedAt); assertRecordedSessionTime(endedAt);
  const duration = endedAt.getTime() - startedAt.getTime();
  if (duration <= 0 || duration > MAX_RECORDED_WORK_INTERVAL_MS) throw new BadRequestException({ code: 'VALIDATION_ERROR' });
}
export function assertSessionVersion(row: Session, expectedVersion: number): void {
  if (row.version !== expectedVersion) throw new ConflictException({ code: 'SESSION_VERSION_CONFLICT' });
}
