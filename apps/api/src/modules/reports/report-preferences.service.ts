import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReportMutation } from '@ehsbha/shared-types';
import { reportPreferencesSchema, type ReportPreferences, type UpdateReportPreferences } from '@ehsbha/api-contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { lockDriverWrites } from '../../common/authorization/driver-write-lock';
import { findMutationReceipt, mutationFingerprint, saveMutationReceipt } from '../../common/operations/mutation-receipt';
import { DEFAULT_REPORT_PREFERENCES } from './reports.control';

function preferencesResponse(value: object): ReportPreferences {
  const row = reportPreferencesSchema.parse(value);
  return { weeklyEnabled: row.weeklyEnabled, monthlyEnabled: row.monthlyEnabled, deliveryMinute: row.deliveryMinute,
    quietEnabled: row.quietEnabled, quietStartMinute: row.quietStartMinute, quietEndMinute: row.quietEndMinute, version: row.version };
}
export async function readReportPreferences(database: Prisma.TransactionClient, driverId: string): Promise<ReportPreferences> {
  const row = await database.reportPreferences.findUnique({ where: { driverId } });
  return row ? preferencesResponse(row) : { ...DEFAULT_REPORT_PREFERENCES };
}
@Injectable()
export class ReportPreferencesService {
  constructor(private prisma: PrismaService) {}
  get(driverId: string): Promise<ReportPreferences> { return readReportPreferences(this.prisma, driverId); }
  update(driverId: string, command: UpdateReportPreferences): Promise<ReportPreferences> {
    return this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      const hash = mutationFingerprint(ReportMutation.Preferences, command);
      const receipt = await findMutationReceipt(tx, driverId, command.clientMutationId, hash);
      const current = await readReportPreferences(tx, driverId);
      if (receipt) return current;
      if (current.version !== command.expectedVersion) throw new ConflictException({ code: 'REPORT_PREFERENCES_CONFLICT' });
      const { clientMutationId, expectedVersion, ...fields } = command;
      const data = { ...fields, version: expectedVersion + 1 };
      const row = await tx.reportPreferences.upsert({ where: { driverId }, create: { driverId, ...data }, update: data });
      await saveMutationReceipt(tx, driverId, clientMutationId, hash, driverId);
      return preferencesResponse(row);
    }, { timeout: 15000 });
  }
}
