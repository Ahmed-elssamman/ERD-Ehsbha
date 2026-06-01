import { z } from 'zod';

export const DashboardRangeSchema = z.enum(['1d', '7d', '30d', '90d']).default('7d');
export type DashboardRange = z.infer<typeof DashboardRangeSchema>;

export const DashboardQuerySchema = z.object({
  range: DashboardRangeSchema.optional(),
});
export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;

const KpiSchema = z.object({
  value: z.number(),
  deltaPct: z.number().nullable(),
  sparkline: z.array(z.number()),
});

export const DashboardOverviewSchema = z.object({
  range: DashboardRangeSchema,
  generatedAt: z.string(),
  users: z.object({
    total: KpiSchema,
    active30d: KpiSchema,
    newToday: KpiSchema,
    newThisWeek: KpiSchema,
    newThisMonth: KpiSchema,
  }),
  drivers: z.object({
    total: KpiSchema,
    active: KpiSchema,
    inactive: KpiSchema,
    retentionPct: KpiSchema,
  }),
  trips: z.object({
    total: KpiSchema,
    today: KpiSchema,
    weekly: KpiSchema,
    monthly: KpiSchema,
  }),
  ocr: z.object({
    requests: KpiSchema,
    successRatePct: KpiSchema,
    failureRatePct: KpiSchema,
    meanConfidencePct: KpiSchema,
  }),
  business: z.object({
    growthRatePct: KpiSchema,
    engagementRatePct: KpiSchema,
    retentionRatePct: KpiSchema,
    conversionRatePct: KpiSchema,
  }),
  queues: z.object({
    openTickets: z.number().int(),
    pendingReviews: z.number().int(),
    flaggedPosts: z.number().int(),
    unreadAlerts: z.number().int(),
  }),
});
export type DashboardOverview = z.infer<typeof DashboardOverviewSchema>;
