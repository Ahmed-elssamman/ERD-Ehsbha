import { z } from 'zod';

export const AdminListDriversQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  baseCity: z.string().optional(),
  isSuspended: z.coerce.boolean().optional(),
  isBlacklisted: z.coerce.boolean().optional(),
  hasTripsSince: z.string().datetime().optional(),
});
export type AdminListDriversQuery = z.infer<typeof AdminListDriversQuerySchema>;

export const AdminDriverRowSchema = z.object({
  id: z.string(),
  userId: z.string(),
  displayName: z.string(),
  phone: z.string(),
  baseCity: z.string().nullable(),
  isSuspended: z.boolean(),
  isBlacklisted: z.boolean(),
  tripCount: z.number().int(),
  lastTripAt: z.string().nullable(),
  joinedAt: z.string(),
});
export type AdminDriverRow = z.infer<typeof AdminDriverRowSchema>;
