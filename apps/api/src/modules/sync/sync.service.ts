import { SyncMutationKind, TripRecordSource } from '@ehsbha/shared-types';
import { PushSchema, type PullDto, type PushDto, type SyncMutation, type SyncMutationResult, type SyncPushResponse } from '@ehsbha/api-contracts';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { lockDriverWrites } from '../../common/authorization/driver-write-lock';
import { findMutationReceipt, mutationFingerprint, saveMutationReceipt } from '../../common/operations/mutation-receipt';
import { TripsService } from '../trips/trips.service';
import { FuelService } from '../fuel/fuel.service';
import { ExpensesService } from '../expenses/expenses.service';
import { SessionsService } from '../sessions/sessions.service';
import { AGGREGATE_TRANSACTION_TIMEOUT_MS } from '../aggregates/aggregate.control';
import { pullSync } from './sync-pull';
import { syncAppliedResult } from './sync-results';
import { syncFailure } from './sync-errors';

export { PullSchema, PushSchema, type PullDto, type PushDto } from '@ehsbha/api-contracts';

@Injectable()
export class SyncService {
  private logger = new Logger(SyncService.name);
  constructor(private prisma: PrismaService, private trips: TripsService, private fuel: FuelService,
    private expenses: ExpensesService, private sessions: SessionsService) {}

  pull(driverId: string, dto: PullDto) { return pullSync(this.prisma, driverId, dto); }

  async push(driverId: string, dto: PushDto): Promise<SyncPushResponse> {
    const parsed = PushSchema.parse(dto), results: SyncMutationResult[] = [];
    for (const mutation of parsed.mutations) {
      try {
        results.push(await this.prisma.$transaction(async (tx) => {
          await lockDriverWrites(tx, driverId);
          const requestHash = mutationFingerprint(mutation.kind, mutation.payload);
          const receipt = await findMutationReceipt(tx, driverId, mutation.clientMutationId, requestHash);
          if (receipt) return syncAppliedResult(tx, mutation.kind, receipt, true);
          const record = await this.applyOne(tx, driverId, mutation);
          const saved = await saveMutationReceipt(tx, driverId, mutation.clientMutationId, requestHash, record.id);
          return syncAppliedResult(tx, mutation.kind, saved, false);
        }, { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS }));
      } catch (error) {
        const failure = syncFailure(mutation, error instanceof Error ? error : new Error());
        this.logger.warn(`sync.push ${mutation.kind} ${failure.error.code}`);
        results.push(failure);
      }
    }
    return { results };
  }

  private applyOne(tx: Prisma.TransactionClient, driverId: string, mutation: SyncMutation) {
    switch (mutation.kind) {
      case SyncMutationKind.TripCreate:
        return this.trips.createInTransaction(tx, driverId, { ...mutation.payload, clientMutationId: mutation.clientMutationId }, TripRecordSource.Sync);
      case SyncMutationKind.FuelCreate:
        return this.fuel.createInTransaction(tx, driverId, { ...mutation.payload, clientMutationId: mutation.clientMutationId });
      case SyncMutationKind.ExpenseCreate:
        return this.expenses.createInTransaction(tx, driverId, { ...mutation.payload, clientMutationId: mutation.clientMutationId });
      case SyncMutationKind.SessionStart:
        return this.sessions.startInTransaction(tx, driverId, { ...mutation.payload, clientMutationId: mutation.clientMutationId });
      case SyncMutationKind.SessionEnd:
        return this.sessions.endInTransaction(tx, driverId, mutation.payload.id, mutation.payload);
    }
  }
}
