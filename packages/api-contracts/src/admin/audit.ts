import { z } from 'zod';

export const AdminListAuditQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  actorAdminId: z.string().optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  occurredAfter: z.string().datetime().optional(),
  occurredBefore: z.string().datetime().optional(),
});
export type AdminListAuditQuery = z.infer<typeof AdminListAuditQuerySchema>;

export const AdminAuditRowSchema = z.object({
  id: z.string(),
  actorAdminId: z.string(),
  actorEmail: z.string(),
  actorRole: z.string(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  reason: z.string().nullable(),
  reasonCode: z.string().nullable(),
  ip: z.string().nullable(),
  occurredAt: z.string(),
  hasBefore: z.boolean(),
  hasAfter: z.boolean(),
});
export type AdminAuditRow = z.infer<typeof AdminAuditRowSchema>;

export const AdminAuditDetailSchema = AdminAuditRowSchema.extend({
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  userAgent: z.string().nullable(),
  requestId: z.string().nullable(),
});
export type AdminAuditDetail = z.infer<typeof AdminAuditDetailSchema>;
