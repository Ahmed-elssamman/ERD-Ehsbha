import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationMutation } from '@ehsbha/shared-types';
import { notificationPreferencesSchema, type NotificationPreferences, type UpdateNotificationPreferences } from '@ehsbha/api-contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { lockDriverWrites } from '../../common/authorization/driver-write-lock';
import { findMutationReceipt, mutationFingerprint, saveMutationReceipt } from '../../common/operations/mutation-receipt';
import { DEFAULT_NOTIFICATION_PREFERENCES } from './notifications.control';

function preferenceResponse(value: object): NotificationPreferences {
  const row = notificationPreferencesSchema.parse(value);
  return { version: row.version, digestEnabled: row.digestEnabled, digestFrequency: row.digestFrequency,
    deliveryMinute: row.deliveryMinute, quietEnabled: row.quietEnabled, quietStartMinute: row.quietStartMinute, quietEndMinute: row.quietEndMinute };
}

export async function readNotificationPreferences(database: Prisma.TransactionClient, driverId: string): Promise<NotificationPreferences> {
  const row = await database.notificationPreferences.findUnique({ where: { driverId } });
  return row ? preferenceResponse(row) : { ...DEFAULT_NOTIFICATION_PREFERENCES };
}

@Injectable()
export class NotificationPreferencesService {
  constructor(private prisma: PrismaService) {}
  get(driverId: string) { return readNotificationPreferences(this.prisma, driverId); }
  update(driverId: string, dto: UpdateNotificationPreferences): Promise<NotificationPreferences> {
    return this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      const hash = mutationFingerprint(NotificationMutation.Preferences, dto);
      const receipt = await findMutationReceipt(tx, driverId, dto.clientMutationId, hash);
      const current = await readNotificationPreferences(tx, driverId);
      if (receipt) return current;
      if (current.version !== dto.expectedVersion) throw new ConflictException({ code: 'NOTIFICATION_PREFERENCES_CONFLICT' });
      const { clientMutationId, expectedVersion, ...fields } = dto;
      const data = { ...fields, version: expectedVersion + 1 };
      const row = await tx.notificationPreferences.upsert({ where: { driverId }, create: { driverId, ...data }, update: data });
      await saveMutationReceipt(tx, driverId, clientMutationId, hash, driverId);
      return preferenceResponse(row);
    }, { timeout: 15_000 });
  }
}
