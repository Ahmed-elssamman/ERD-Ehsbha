import { Notification } from '@prisma/client';
import { notificationDataSchema } from '@ehsbha/api-contracts';

export function notificationResponse(row: Notification) {
  const data = notificationDataSchema.safeParse(row.data);
  return { id: row.id, kind: row.kind, channel: row.channel, title: row.title, body: row.body,
    sentAt: row.sentAt.toISOString(), readAt: row.readAt?.toISOString() ?? null, data: data.success ? data.data : null };
}
