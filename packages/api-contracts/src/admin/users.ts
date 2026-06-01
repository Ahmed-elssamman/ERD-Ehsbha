import { z } from 'zod';

export const AdminListUsersQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
  search: z.string().optional(),
  isBlacklisted: z.coerce.boolean().optional(),
});
export type AdminListUsersQuery = z.infer<typeof AdminListUsersQuerySchema>;

export const AdminUserRowSchema = z.object({
  id: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']),
  locale: z.string(),
  isBlacklisted: z.boolean(),
  driverId: z.string().nullable(),
  tripCount: z.number().int(),
  createdAt: z.string(),
  lastActivityAt: z.string().nullable(),
});
export type AdminUserRow = z.infer<typeof AdminUserRowSchema>;

export const SuspendUserRequestSchema = z.object({
  reason: z.string().min(3).max(500),
  reasonCode: z
    .enum(['POLICY_VIOLATION', 'FRAUD', 'SPAM', 'USER_REQUEST', 'OTHER'])
    .default('OTHER'),
});
export type SuspendUserRequest = z.infer<typeof SuspendUserRequestSchema>;

export const BlacklistUserRequestSchema = SuspendUserRequestSchema;
export type BlacklistUserRequest = SuspendUserRequest;
