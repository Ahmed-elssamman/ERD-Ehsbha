import { z } from 'zod'
import { registerOperation } from '../catalog/registry'
import { DEFAULT_PAGE_SIZE, MAXIMUM_PAGE_SIZE } from '../core/pagination'

const CATEGORY_VALUES = [
  'BEST_APPS',
  'EXPERIENCE_UBER',
  'EXPERIENCE_INDRIVE',
  'EXPERIENCE_DIDI',
  'EXPERIENCE_OTHER',
  'FUEL_SAVING',
  'BEST_HOURS',
  'MAINTENANCE_ADVICE',
  'EFFICIENCY_TIPS',
  'OPERATIONAL_MISTAKES',
  'WEEKLY_LESSON',
  'SAFETY_ADVICE',
  'GENERAL',
] as const

const TicketCategoryValues = ['BUG', 'FEATURE_REQUEST', 'IMPROVEMENT', 'QUESTION', 'OTHER'] as const

export const communityCategorySchema = z.object({
  code: z.enum(CATEGORY_VALUES),
}).passthrough()

export const ListPostsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAXIMUM_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  category: z.enum(CATEGORY_VALUES).optional(),
  sort: z.enum(['latest', 'trending', 'top']).default('latest'),
  mine: z.coerce.boolean().optional(),
}).strict()

export const CreatePostSchema = z.object({
  category: z.enum(CATEGORY_VALUES),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(10).max(2000),
}).strict()

export const ReactSchema = z.object({
  kind: z.enum(['LIKE', 'DISLIKE']),
}).strict()

export const communityPostAuthorSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  baseCity: z.string().nullable(),
}).passthrough()

export const driverCommunityPostSchema = z.object({
  id: z.string(),
  category: z.enum(CATEGORY_VALUES),
  title: z.string(),
  body: z.string(),
  likeCount: z.number().int(),
  dislikeCount: z.number().int(),
  createdAt: z.string(),
  author: communityPostAuthorSchema,
  myReaction: z.enum(['LIKE', 'DISLIKE']).nullable(),
  isOwn: z.boolean(),
}).passthrough()

export const communityPostSchema = driverCommunityPostSchema

export const communityListResponseSchema = z.object({
  items: z.array(driverCommunityPostSchema),
  nextCursor: z.string().nullable(),
}).passthrough()

export const acknowledgedResultSchema = z.object({
  ok: z.literal(true),
}).passthrough()

export const RegisterDeviceSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(['ios', 'android', 'web']),
}).strict()

export const ListNotificationsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAXIMUM_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
}).strict()

export const appNotificationSchema = z.object({
  id: z.string(),
  channel: z.string(),
  title: z.string(),
  body: z.string(),
  sentAt: z.string(),
  readAt: z.string().nullable(),
  data: z.record(z.unknown()).nullable().optional(),
}).passthrough()

export const notificationSchema = z.object({
  id: z.string(),
  driverId: z.string().optional(),
  adminId: z.string().optional(),
  title: z.string(),
  body: z.string(),
  type: z.string(),
  read: z.boolean().optional(),
  createdAt: z.string(),
}).passthrough()

export const notificationsListSchema = z.object({
  items: z.array(appNotificationSchema),
  nextCursor: z.string().nullable(),
}).passthrough()

export const deviceTokenRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  token: z.string(),
  platform: z.string(),
  lastUsedAt: z.string().optional(),
  createdAt: z.string().optional(),
}).passthrough()

export const dailyDigestDataSchema = z.object({
  kind: z.literal('DAILY_DIGEST'),
  locale: z.enum(['ar', 'en']),
  insights: z.object({
    todayTargetPiastres: z.number().nullable(),
    monthlyGoalPiastres: z.number().nullable(),
    earnedThisMonthPiastres: z.number(),
    remainingDaysInMonth: z.number().int(),
    bestHour: z.object({
      hour: z.number().int(),
      netEgpPerHr: z.number(),
    }).strict().nullable(),
    bestAppForDow: z.object({
      appId: z.string(),
      appName: z.string(),
      netPiastres: z.number(),
    }).strict().nullable(),
    lowEgpPerKmArea: z.object({
      areaId: z.string(),
      areaName: z.string(),
      egpPerKm: z.number(),
    }).strict().nullable(),
    emptyKmRatioYesterday: z.number().nullable(),
    yesterdayNetPiastres: z.number(),
  }).strict(),
  tips: z.array(z.object({
    key: z.string(),
    vars: z.record(z.union([z.string(), z.number()])),
  }).strict()),
}).strict()

export const dailyDigestTriggerResultSchema = z.object({
  notificationId: z.string(),
}).passthrough()

export const publicReviewSchema = z.object({
  id: z.string(),
  authorName: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
  title: z.string().nullable().optional(),
  body: z.string().optional(),
  createdAt: z.string(),
  author: z.object({
    displayName: z.string(),
    baseCity: z.string().nullable(),
  }).passthrough().optional(),
}).passthrough()

export const platformReviewSchema = z.object({
  id: z.string(),
  rating: z.number().int().min(1).max(5),
  title: z.string().nullable(),
  body: z.string(),
  createdAt: z.string(),
  author: z.object({
    id: z.string().optional(),
    displayName: z.string(),
    baseCity: z.string().nullable(),
  }).passthrough(),
}).passthrough()

export const reviewSchema = platformReviewSchema

export const reviewsSummarySchema = z.object({
  count: z.number().int(),
  averageRating: z.number(),
  distribution: z.object({
    '1': z.number().int(),
    '2': z.number().int(),
    '3': z.number().int(),
    '4': z.number().int(),
    '5': z.number().int(),
  }).passthrough(),
}).passthrough()

export const UpsertReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().min(2).max(120).optional().or(z.literal('')),
  body: z.string().trim().min(10).max(1000),
}).strict()

export const ListReviewsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAXIMUM_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  rating: z.coerce.number().int().min(1).max(5).optional(),
}).strict()

export const reviewsListResponseSchema = z.object({
  items: z.array(platformReviewSchema),
  nextCursor: z.string().nullable(),
}).passthrough()

export const myReviewSchema = z.object({
  id: z.string(),
  rating: z.number().int().min(1).max(5),
  title: z.string().nullable(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough()

export const driverSupportTicketSchema = z.object({
  id: z.string(),
  category: z.enum(TicketCategoryValues),
  subject: z.string(),
  body: z.string(),
  status: z.enum(['OPEN', 'IN_REVIEW', 'PLANNED', 'RESOLVED', 'CLOSED']),
  adminNote: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough()

export const supportTicketSchema = driverSupportTicketSchema

export const supportTicketListResponseSchema = z.object({
  items: z.array(driverSupportTicketSchema),
  nextCursor: z.string().nullable(),
}).passthrough()

export const CreateTicketSchema = z.object({
  category: z.enum(TicketCategoryValues),
  subject: z.string().trim().min(3).max(140),
  body: z.string().trim().min(10).max(2000),
}).strict()

export const ListTicketsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAXIMUM_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
}).strict()

const producer = [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }] as const

registerOperation({
  operationId: 'driver.notifications.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/notifications',
  realm: 'driver',
  lifecycle: 'active',
  request: { query: 'ListNotificationsSchema' },
  successData: 'notificationsListSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: { mode: 'cursor', defaultSize: DEFAULT_PAGE_SIZE, maximumSize: MAXIMUM_PAGE_SIZE, stableSort: ['sentAt:desc', 'id:desc'], exceptionOwner: null, exceptionReason: null },
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.notifications.mark-read',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/notifications/:id/read',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'appNotificationSchema',
  failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.notifications.devices.register',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/notifications/devices',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'RegisterDeviceSchema' },
  successData: 'deviceTokenRecordSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.notifications.daily-digest.trigger',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/notifications/daily-digest/me',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'dailyDigestTriggerResultSchema',
  failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.community.categories',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/community/categories',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'communityCategorySchema',
  failureCodes: ['UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.community.posts.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/community/posts',
  realm: 'driver',
  lifecycle: 'active',
  request: { query: 'ListPostsSchema' },
  successData: 'communityListResponseSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: { mode: 'cursor', defaultSize: DEFAULT_PAGE_SIZE, maximumSize: MAXIMUM_PAGE_SIZE, stableSort: ['createdAt:desc', 'id:desc'], exceptionOwner: null, exceptionReason: null },
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.community.posts.create',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/community/posts',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'CreatePostSchema' },
  successData: 'driverCommunityPostSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.community.posts.react',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/community/posts/:id/react',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'ReactSchema' },
  successData: 'driverCommunityPostSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.community.posts.delete',
  transport: 'http',
  method: 'DELETE',
  path: '/api/v1/community/posts/:id',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'acknowledgedResultSchema',
  failureCodes: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'public.reviews.featured',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/public/reviews/featured',
  realm: 'public',
  lifecycle: 'active',
  request: {},
  successData: 'publicReviewSchema',
  failureCodes: [],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'public.reviews.summary',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/public/reviews/summary',
  realm: 'public',
  lifecycle: 'active',
  request: {},
  successData: 'reviewsSummarySchema',
  failureCodes: [],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.reviews.summary',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/reviews/summary',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'reviewsSummarySchema',
  failureCodes: ['UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.reviews.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/reviews',
  realm: 'driver',
  lifecycle: 'active',
  request: { query: 'ListReviewsSchema' },
  successData: 'reviewsListResponseSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: { mode: 'cursor', defaultSize: DEFAULT_PAGE_SIZE, maximumSize: MAXIMUM_PAGE_SIZE, stableSort: ['createdAt:desc', 'id:desc'], exceptionOwner: null, exceptionReason: null },
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.reviews.mine.get',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/reviews/me',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'myReviewSchema',
  failureCodes: ['UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.reviews.mine.upsert',
  transport: 'http',
  method: 'PUT',
  path: '/api/v1/reviews/me',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'UpsertReviewSchema' },
  successData: 'myReviewSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.reviews.mine.create',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/reviews/me',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'UpsertReviewSchema' },
  successData: 'myReviewSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.reviews.mine.delete',
  transport: 'http',
  method: 'DELETE',
  path: '/api/v1/reviews/me',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'acknowledgedResultSchema',
  failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.support.tickets.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/support/tickets',
  realm: 'driver',
  lifecycle: 'active',
  request: { query: 'ListTicketsSchema' },
  successData: 'supportTicketListResponseSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: { mode: 'cursor', defaultSize: DEFAULT_PAGE_SIZE, maximumSize: MAXIMUM_PAGE_SIZE, stableSort: ['createdAt:desc', 'id:desc'], exceptionOwner: null, exceptionReason: null },
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.support.tickets.get',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/support/tickets/:id',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'driverSupportTicketSchema',
  failureCodes: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.support.tickets.create',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/support/tickets',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'CreateTicketSchema' },
  successData: 'driverSupportTicketSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.support.tickets.close',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/support/tickets/:id/close',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'acknowledgedResultSchema',
  failureCodes: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})
