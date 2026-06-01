import { z } from 'zod';

export const CreateDriverAppSchema = z.object({
  appSourceId: z.string().min(1).optional(),
  customName: z.string().min(2).max(40).optional(),
  commissionPct: z.number().min(0).max(60).default(20),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  enabled: z.boolean().default(true),
}).refine(
  (v) => !!v.appSourceId || !!v.customName,
  { message: 'Either appSourceId or customName is required' },
);
export type CreateDriverAppDto = z.infer<typeof CreateDriverAppSchema>;

export const UpdateDriverAppSchema = z.object({
  commissionPct: z.number().min(0).max(60).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  enabled: z.boolean().optional(),
  customName: z.string().min(2).max(40).nullable().optional(),
});
export type UpdateDriverAppDto = z.infer<typeof UpdateDriverAppSchema>;
