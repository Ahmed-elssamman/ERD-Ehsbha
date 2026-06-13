import { z } from 'zod'
import { registerOperation } from '../catalog/registry'
import { affectedResultSchema, cursorPageSchema, okResultSchema } from './admin-core'

export const adminAuditListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  actorAdminId: z.string().optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  occurredAfter: z.string().datetime().optional(),
  occurredBefore: z.string().datetime().optional(),
}).strict()

export const BulkBody = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  reason: z.string().min(3).max(500),
}).strict()

export const BulkTransitionBody = BulkBody.extend({
  status: z.enum(['OPEN', 'IN_REVIEW', 'PLANNED', 'RESOLVED', 'CLOSED']),
})

export const adminCommunityListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  isHidden: z.coerce.boolean().optional(),
}).strict()

export const ReasonBodySchema = z.object({
  reason: z.string().min(3).max(500),
}).strict()

export const CreateAdminSchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(80),
  roleCodes: z.array(z.string().min(1)).min(1).max(10),
}).strict()

export const SetActiveSchema = z.object({
  isActive: z.boolean(),
}).strict()

export const UpdateRolePermsSchema = z.object({
  permissions: z.array(z.string().regex(/^[a-z_]+\.[a-z_]+$/)).max(200),
}).strict()

export const AlertsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  severity: z.enum(['info', 'medium', 'high', 'critical']).optional(),
  resolved: z.coerce.boolean().optional(),
}).strict()

export const NotifsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict()

export const adminReviewsListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  isApproved: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
}).strict()

export const adminSupportListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['OPEN', 'IN_REVIEW', 'PLANNED', 'RESOLVED', 'CLOSED']).optional(),
  category: z.enum(['BUG', 'FEATURE_REQUEST', 'IMPROVEMENT', 'QUESTION', 'OTHER']).optional(),
}).strict()

export const TransitionSchema = z.object({
  status: z.enum(['OPEN', 'IN_REVIEW', 'PLANNED', 'RESOLVED', 'CLOSED']),
  reason: z.string().min(3).max(500).optional(),
}).strict()

export const NoteSchema = z.object({
  adminNote: z.string().min(1).max(5000),
}).strict()

export const ActionBodySchema = z.object({
  reason: z.string().min(3).max(500),
  reasonCode: z
    .enum(['POLICY_VIOLATION', 'FRAUD', 'SPAM', 'USER_REQUEST', 'OTHER'])
    .default('OTHER'),
}).strict()

export const BulkActionBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  reason: z.string().min(3).max(500),
  reasonCode: z
    .enum(['POLICY_VIOLATION', 'FRAUD', 'SPAM', 'USER_REQUEST', 'OTHER'])
    .default('OTHER'),
}).strict()

export const moderationActionSchema = z.object({
  id: z.string(),
  moderatorId: z.string(),
  targetType: z.enum(['driver', 'post', 'review']),
  targetId: z.string(),
  action: z.string(),
  reason: z.string(),
  createdAt: z.string(),
}).passthrough()

export const auditRecordSchema = z.object({
  id: z.string(),
  adminId: z.string(),
  action: z.string(),
  targetId: z.string().optional(),
  details: z.record(z.unknown()).optional(),
  ipAddress: z.string().optional(),
  timestamp: z.string(),
}).passthrough()

export const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
  permissions: z.array(z.string()),
  description: z.string().optional(),
}).passthrough()

export const permissionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  scope: z.string(),
}).passthrough()

const adminSettingValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
  z.record(z.unknown()),
])

export const UpdateSettingSchema = z.object({
  value: adminSettingValueSchema,
}).strict()

export const adminCommunityPostSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  category: z.string(),
  likeCount: z.number().int(),
  dislikeCount: z.number().int(),
  trendingScore: z.number(),
  isHidden: z.boolean(),
  driverId: z.string(),
  driverDisplayName: z.string(),
  driverPhone: z.string(),
  createdAt: z.string(),
}).passthrough()
export const adminCommunityPostsPageSchema = cursorPageSchema(adminCommunityPostSchema)

export const adminCommunityPostStateSchema = z.object({
  id: z.string(),
  isHidden: z.boolean(),
  title: z.string(),
}).passthrough()

export const adminReviewSchema = z.object({
  id: z.string(),
  rating: z.number().int(),
  title: z.string().nullable(),
  body: z.string(),
  isApproved: z.boolean(),
  isFeatured: z.boolean(),
  driverId: z.string(),
  driverDisplayName: z.string(),
  driverPhone: z.string(),
  createdAt: z.string(),
}).passthrough()
export const adminReviewsPageSchema = cursorPageSchema(adminReviewSchema)

export const adminReviewStateSchema = z.object({
  id: z.string(),
  isApproved: z.boolean(),
  isFeatured: z.boolean(),
}).passthrough()

export const adminReviewsSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  approved: z.number().int().nonnegative(),
  featured: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  avgRating: z.number(),
  distribution: z.array(z.object({
    rating: z.number().int(),
    count: z.number().int().nonnegative(),
  }).strict()),
}).passthrough()

export const adminSupportTicketSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userPhone: z.string(),
  userEmail: z.string().nullable(),
  category: z.enum(['BUG', 'FEATURE_REQUEST', 'IMPROVEMENT', 'QUESTION', 'OTHER']),
  subject: z.string(),
  body: z.string(),
  status: z.enum(['OPEN', 'IN_REVIEW', 'PLANNED', 'RESOLVED', 'CLOSED']),
  adminNote: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough()
export const adminSupportTicketsPageSchema = cursorPageSchema(adminSupportTicketSchema)

export const adminSupportTicketDetailSchema = z.object({
  id: z.string(),
  userId: z.string(),
  category: z.enum(['BUG', 'FEATURE_REQUEST', 'IMPROVEMENT', 'QUESTION', 'OTHER']),
  subject: z.string(),
  body: z.string(),
  status: z.enum(['OPEN', 'IN_REVIEW', 'PLANNED', 'RESOLVED', 'CLOSED']),
  adminNote: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  user: z.object({
    id: z.string(),
    phone: z.string(),
    email: z.string().nullable(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']),
  }).passthrough(),
}).passthrough()

export const adminSupportTransitionSchema = z.object({
  id: z.string(),
  status: z.enum(['OPEN', 'IN_REVIEW', 'PLANNED', 'RESOLVED', 'CLOSED']),
  subject: z.string(),
}).passthrough()

export const adminSupportNoteSchema = z.object({
  id: z.string(),
  adminNote: z.string().nullable(),
}).passthrough()

export const adminSupportSummarySchema = z.object({
  byStatus: z.object({
    open: z.number().int().nonnegative(),
    inReview: z.number().int().nonnegative(),
    planned: z.number().int().nonnegative(),
    resolved: z.number().int().nonnegative(),
    closed: z.number().int().nonnegative(),
  }).strict(),
  byCategory: z.array(z.object({
    category: z.string(),
    count: z.number().int().nonnegative(),
  }).strict()),
}).passthrough()

export const adminAlertSchema = z.object({
  id: z.string(),
  code: z.string(),
  severity: z.enum(['info', 'medium', 'high', 'critical']),
  title: z.string(),
  body: z.string(),
  resolvedAt: z.string().nullable(),
  createdAt: z.string(),
}).passthrough()
export const adminAlertsPageSchema = cursorPageSchema(adminAlertSchema)

export const adminOutboundNotificationSchema = z.object({
  id: z.string(),
  channel: z.string(),
  title: z.string(),
  body: z.string(),
  sentAt: z.string(),
  readAt: z.string().nullable(),
  driverId: z.string(),
  driverPhone: z.string(),
  driverDisplayName: z.string(),
}).passthrough()
export const adminOutboundNotificationsPageSchema = cursorPageSchema(adminOutboundNotificationSchema)

export const adminAuditListItemSchema = z.object({
  id: z.string(),
  actorAdminId: z.string(),
  actorEmail: z.string(),
  actorDisplayName: z.string(),
  actorRole: z.string(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  reason: z.string().nullable(),
  reasonCode: z.string().nullable(),
  ip: z.string().nullable(),
  occurredAt: z.string(),
  hasBefore: z.boolean(),
  hasAfter: z.boolean(),
}).passthrough()
export const adminAuditPageSchema = cursorPageSchema(adminAuditListItemSchema)

export const adminAuditActionSchema = z.object({
  action: z.string(),
  count: z.number().int().nonnegative(),
}).passthrough()

export const adminAuditDetailSchema = z.object({
  id: z.string(),
  actorAdminId: z.string(),
  actorRole: z.string(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  before: z.unknown().nullable().optional(),
  after: z.unknown().nullable().optional(),
  reason: z.string().nullable().optional(),
  reasonCode: z.string().nullable().optional(),
  ip: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  requestId: z.string().nullable().optional(),
  occurredAt: z.string(),
  actor: z.object({
    email: z.string(),
    displayName: z.string(),
  }).passthrough(),
}).passthrough()

export const adminRoleSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  permissionCount: z.number().int().nonnegative(),
  userCount: z.number().int().nonnegative(),
  permissions: z.array(z.string()),
}).passthrough()

export const adminPermissionSchema = z.object({
  id: z.number().int(),
  scope: z.string(),
  action: z.string(),
  description: z.string().nullable(),
}).passthrough()

export const adminAccountSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  isActive: z.boolean(),
  mfaEnabled: z.boolean(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
  roles: z.array(z.string()),
}).passthrough()

export const createdAdminSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
}).passthrough()

export const adminActiveStateSchema = z.object({
  id: z.string(),
  isActive: z.boolean(),
}).passthrough()

export const adminRolePermissionsSchema = z.object({
  id: z.string(),
  permissions: z.array(z.string()),
}).passthrough()

export const adminSettingSchema = z.object({
  key: z.string(),
  description: z.string().nullable(),
  value: adminSettingValueSchema,
  isDefault: z.boolean().optional(),
  updatedAt: z.string().nullable(),
  updatedById: z.string().nullable(),
}).passthrough()

export const adminSettingsSchema = adminSettingSchema
export const adminSettingListSchema = adminSettingSchema

export const adminAnalyticsOverviewSchema = z.object({
  since: z.string(),
  tripsByApp: z.array(z.object({
    driverAppId: z.string(),
    appName: z.string(),
    tripCount: z.number().int(),
    grossPiastres: z.number(),
  }).strict()),
  tripsByDay: z.array(z.object({
    day: z.string(),
    trips: z.number().int(),
    gross: z.number(),
  }).strict()),
  tripsByArea: z.array(z.object({
    areaId: z.string().nullable(),
    areaName: z.string(),
    tripCount: z.number().int(),
    grossPiastres: z.number(),
  }).strict()),
  topDriversByProfit: z.array(z.object({
    driverId: z.string(),
    year: z.number().int(),
    month: z.number().int(),
    netProfitPiastres: z.number(),
    grossPiastres: z.number(),
    phone: z.string(),
    displayName: z.string(),
  }).strict()),
  topPosts: z.array(z.object({
    id: z.string(),
    title: z.string(),
    category: z.string(),
    likeCount: z.number().int(),
    dislikeCount: z.number().int(),
    driverId: z.string(),
    driverDisplayName: z.string(),
    driverPhone: z.string(),
    createdAt: z.string(),
  }).strict()),
  topTicketSubjects: z.array(z.object({
    category: z.string(),
    status: z.string(),
    count: z.number().int(),
  }).strict()),
  totals: z.object({
    grossPiastres: z.number(),
    netProfitPiastres: z.number(),
    totalKmMeters: z.number(),
    fuelPiastres: z.number(),
  }).strict(),
}).passthrough()

export const pendingSchemaNoticeSchema = z.object({
  status: z.literal('PENDING_SCHEMA'),
  message: z.string(),
  hint: z.string(),
}).passthrough()

export const adminHealthSnapshotSchema = z.object({
  checks: z.record(z.object({
    ok: z.boolean(),
    message: z.string(),
  }).strict()),
  counts: z.object({
    users: z.number().int().nonnegative(),
    drivers: z.number().int().nonnegative(),
    trips: z.number().int().nonnegative(),
    activeDriverRefreshTokens: z.number().int().nonnegative(),
    activeAdminRefreshTokens: z.number().int().nonnegative(),
    openSupportTickets: z.number().int().nonnegative(),
  }).strict(),
  generatedAt: z.string(),
}).passthrough()

const producer = [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }] as const

function op(operationId: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, request: Record<string, string>, successData: string, failureCodes: string[]) {
  registerOperation({
    operationId,
    transport: 'http',
    method,
    path,
    realm: 'admin',
    lifecycle: 'active',
    request,
    successData,
    failureCodes,
    consumers: [...producer],
    compatibility: 'additive-compatible',
    owner: 'platform',
    pagination: null,
    idempotency: null,
    followUp: null,
  })
}

op('admin.analytics.overview', 'GET', '/api/v1/admin/analytics/overview', {}, 'adminAnalyticsOverviewSchema', ['UNAUTHENTICATED', 'FORBIDDEN', 'ADMIN_PERMISSIONS_STALE'])
op('admin.audit.list', 'GET', '/api/v1/admin/audit', { query: 'adminAuditListQuerySchema' }, 'adminAuditPageSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'ADMIN_PERMISSIONS_STALE'])
op('admin.audit.actions', 'GET', '/api/v1/admin/audit/actions', {}, 'adminAuditActionSchema', ['UNAUTHENTICATED', 'FORBIDDEN', 'ADMIN_PERMISSIONS_STALE'])
op('admin.audit.get', 'GET', '/api/v1/admin/audit/:id', {}, 'adminAuditDetailSchema', ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'])

op('admin.bulk.drivers.suspend', 'POST', '/api/v1/admin/drivers/bulk/suspend', { body: 'BulkBody' }, 'affectedResultSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.bulk.drivers.activate', 'POST', '/api/v1/admin/drivers/bulk/activate', { body: 'BulkBody' }, 'affectedResultSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.bulk.trips.delete', 'POST', '/api/v1/admin/trips/bulk/delete', { body: 'BulkBody' }, 'affectedResultSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.bulk.trips.restore', 'POST', '/api/v1/admin/trips/bulk/restore', { body: 'BulkBody' }, 'affectedResultSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.bulk.community.posts.delete', 'POST', '/api/v1/admin/community/posts/bulk/delete', { body: 'BulkBody' }, 'affectedResultSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.bulk.reviews.delete', 'POST', '/api/v1/admin/reviews/bulk/delete', { body: 'BulkBody' }, 'affectedResultSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.bulk.support.tickets.transition', 'POST', '/api/v1/admin/support/tickets/bulk/transition', { body: 'BulkTransitionBody' }, 'affectedResultSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.bulk.support.tickets.delete', 'POST', '/api/v1/admin/support/tickets/bulk/delete', { body: 'BulkBody' }, 'affectedResultSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.bulk.vehicles.delete', 'POST', '/api/v1/admin/vehicles/bulk/delete', { body: 'BulkBody' }, 'affectedResultSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'])

op('admin.community.posts.list', 'GET', '/api/v1/admin/community/posts', { query: 'adminCommunityListQuerySchema' }, 'adminCommunityPostsPageSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.community.posts.get', 'GET', '/api/v1/admin/community/posts/:id', {}, 'adminCommunityPostSchema', ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'])
op('admin.community.posts.hide', 'POST', '/api/v1/admin/community/posts/:id/hide', {}, 'adminCommunityPostStateSchema', ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'])
op('admin.community.posts.unhide', 'POST', '/api/v1/admin/community/posts/:id/unhide', {}, 'adminCommunityPostStateSchema', ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'])
op('admin.community.posts.delete', 'DELETE', '/api/v1/admin/community/posts/:id', { body: 'ReasonBodySchema' }, 'okResultSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'])

op('admin.admins.create', 'POST', '/api/v1/admin/admins', { body: 'CreateAdminSchema' }, 'createdAdminSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'CONFLICT'])
op('admin.admins.delete', 'DELETE', '/api/v1/admin/admins/:id', {}, 'okResultSchema', ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'])
op('admin.admins.set-active', 'PATCH', '/api/v1/admin/admins/:id/active', { body: 'SetActiveSchema' }, 'adminActiveStateSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'])
op('admin.roles.set-permissions', 'PATCH', '/api/v1/admin/roles/:id/permissions', { body: 'UpdateRolePermsSchema' }, 'adminRolePermissionsSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'])

op('admin.ocr.overview', 'GET', '/api/v1/admin/ocr/overview', {}, 'pendingSchemaNoticeSchema', ['UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.feature-usage.overview', 'GET', '/api/v1/admin/feature-usage/overview', {}, 'pendingSchemaNoticeSchema', ['UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.revenue.overview', 'GET', '/api/v1/admin/revenue/overview', {}, 'pendingSchemaNoticeSchema', ['UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.health.snapshot', 'GET', '/api/v1/admin/health/snapshot', {}, 'adminHealthSnapshotSchema', ['UNAUTHENTICATED', 'FORBIDDEN'])

op('admin.notifications.alerts', 'GET', '/api/v1/admin/notifications/alerts', { query: 'AlertsQuerySchema' }, 'adminAlertsPageSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.notifications.outbound', 'GET', '/api/v1/admin/notifications/outbound', { query: 'NotifsQuerySchema' }, 'adminOutboundNotificationsPageSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'])

op('admin.reviews.list', 'GET', '/api/v1/admin/reviews', { query: 'adminReviewsListQuerySchema' }, 'adminReviewsPageSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.reviews.summary', 'GET', '/api/v1/admin/reviews/summary', {}, 'adminReviewsSummarySchema', ['UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.reviews.approve', 'POST', '/api/v1/admin/reviews/:id/approve', {}, 'adminReviewStateSchema', ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'])
op('admin.reviews.unapprove', 'POST', '/api/v1/admin/reviews/:id/unapprove', {}, 'adminReviewStateSchema', ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'])
op('admin.reviews.feature', 'POST', '/api/v1/admin/reviews/:id/feature', {}, 'adminReviewStateSchema', ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'])
op('admin.reviews.unfeature', 'POST', '/api/v1/admin/reviews/:id/unfeature', {}, 'adminReviewStateSchema', ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'])
op('admin.reviews.delete', 'DELETE', '/api/v1/admin/reviews/:id', { body: 'ReasonBodySchema' }, 'okResultSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'])

op('admin.roles.list', 'GET', '/api/v1/admin/roles', {}, 'adminRoleSchema', ['UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.permissions.list', 'GET', '/api/v1/admin/permissions', {}, 'adminPermissionSchema', ['UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.admins.list', 'GET', '/api/v1/admin/admins', {}, 'adminAccountSchema', ['UNAUTHENTICATED', 'FORBIDDEN'])

op('admin.settings.list', 'GET', '/api/v1/admin/settings', {}, 'adminSettingSchema', ['UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.settings.update', 'PATCH', '/api/v1/admin/settings/:key', { body: 'UpdateSettingSchema' }, 'adminSettingSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'])

op('admin.support.tickets.list', 'GET', '/api/v1/admin/support/tickets', { query: 'adminSupportListQuerySchema' }, 'adminSupportTicketsPageSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.support.summary', 'GET', '/api/v1/admin/support/summary', {}, 'adminSupportSummarySchema', ['UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.support.tickets.get', 'GET', '/api/v1/admin/support/tickets/:id', {}, 'adminSupportTicketDetailSchema', ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'])
op('admin.support.tickets.transition', 'POST', '/api/v1/admin/support/tickets/:id/transition', { body: 'TransitionSchema' }, 'adminSupportTransitionSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'])
op('admin.support.tickets.note', 'POST', '/api/v1/admin/support/tickets/:id/note', { body: 'NoteSchema' }, 'adminSupportNoteSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'])

op('admin.users.suspend', 'POST', '/api/v1/admin/users/:id/suspend', { body: 'ActionBodySchema' }, 'adminUserStatusSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'])
op('admin.users.activate', 'POST', '/api/v1/admin/users/:id/activate', { body: 'ActionBodySchema' }, 'adminUserStatusSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'])
op('admin.users.bulk.suspend', 'POST', '/api/v1/admin/users/bulk/suspend', { body: 'BulkActionBodySchema' }, 'affectedResultSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.users.bulk.activate', 'POST', '/api/v1/admin/users/bulk/activate', { body: 'BulkActionBodySchema' }, 'affectedResultSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'])
op('admin.users.bulk.delete', 'POST', '/api/v1/admin/users/bulk/delete', { body: 'BulkActionBodySchema' }, 'affectedResultSchema', ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'])
