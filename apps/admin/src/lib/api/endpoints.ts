import type { AxiosResponse } from 'axios';
import { z } from 'zod';
import {
  affectedResultSchema,
  adminAccountSchema,
  adminActiveStateSchema,
  adminAlertSchema,
  adminAnalyticsOverviewSchema,
  adminAuditActionSchema,
  adminAuditListItemSchema,
  adminCommunityPostSchema,
  adminCommunityPostStateSchema,
  adminDriverDetailSchema,
  adminDriversPageSchema,
  adminEntitySchema,
  adminHealthSnapshotSchema,
  adminOutboundNotificationSchema,
  adminPermissionSchema,
  adminRecentTripSchema,
  adminReviewSchema,
  adminReviewsSummarySchema,
  adminReviewStateSchema,
  adminRolePermissionsSchema,
  adminRoleSchema,
  adminSettingListSchema,
  adminSettingSchema,
  adminSupportNoteSchema,
  adminSupportSummarySchema,
  adminSupportTicketDetailSchema,
  adminSupportTicketSchema,
  adminSupportTransitionSchema,
  adminTripDetailSchema,
  adminTripsPageSchema,
  adminUserDetailSchema,
  adminUsersPageSchema,
  adminUserStatusSchema,
  adminVehiclesPageSchema,
  createdAdminSchema,
  cursorPageSchema,
  okResultSchema,
  pendingSchemaNoticeSchema,
} from '@ehsbha/api-contracts';
import { generateIdempotencyKey, parseData } from '@/features/platform-api';
import { adminApi } from './admin-client';

const communityPageSchema = cursorPageSchema(adminCommunityPostSchema);
const reviewsPageSchema = cursorPageSchema(adminReviewSchema);
const supportPageSchema = cursorPageSchema(adminSupportTicketSchema);
const alertsPageSchema = cursorPageSchema(adminAlertSchema);
const outboundPageSchema = cursorPageSchema(adminOutboundNotificationSchema);
const auditPageSchema = cursorPageSchema(adminAuditListItemSchema);

async function governed<S extends z.ZodTypeAny>(
  request: Promise<AxiosResponse<unknown>>,
  schema: S,
  operationId: string,
): Promise<z.output<S>> {
  const response = await request;
  return parseData(schema, response.data, operationId);
}

const idempotencyConfig = () => ({
  headers: { 'Idempotency-Key': generateIdempotencyKey() },
});

export const usersApi = {
  list: (params: { search?: string; status?: string; cursor?: string; limit?: number }) =>
    governed(adminApi.get('/admin/users', { params }), adminUsersPageSchema, 'admin.users.list'),
  get: (id: string) =>
    governed(adminApi.get(`/admin/users/${id}`), adminUserDetailSchema, 'admin.users.get'),
  suspend: (id: string, reason: string, reasonCode: string) =>
    governed(
      adminApi.post(`/admin/users/${id}/suspend`, { reason, reasonCode }, idempotencyConfig()),
      adminUserStatusSchema,
      'admin.users.suspend',
    ),
  activate: (id: string, reason: string, reasonCode: string) =>
    governed(
      adminApi.post(`/admin/users/${id}/activate`, { reason, reasonCode }, idempotencyConfig()),
      adminUserStatusSchema,
      'admin.users.activate',
    ),
  bulkSuspend: (ids: string[], reason: string) =>
    governed(
      adminApi.post('/admin/users/bulk/suspend', { ids, reason }, idempotencyConfig()),
      affectedResultSchema,
      'admin.users.bulk-suspend',
    ),
  bulkActivate: (ids: string[], reason: string) =>
    governed(
      adminApi.post('/admin/users/bulk/activate', { ids, reason }, idempotencyConfig()),
      affectedResultSchema,
      'admin.users.bulk-activate',
    ),
  bulkDelete: (ids: string[], reason: string) =>
    governed(
      adminApi.post('/admin/users/bulk/delete', { ids, reason }, idempotencyConfig()),
      affectedResultSchema,
      'admin.users.bulk-delete',
    ),
};

export const driversApi = {
  list: (params: { search?: string; cursor?: string; limit?: number }) =>
    governed(adminApi.get('/admin/drivers', { params }), adminDriversPageSchema, 'admin.drivers.list'),
  get: (id: string) =>
    governed(adminApi.get(`/admin/drivers/${id}`), adminDriverDetailSchema, 'admin.drivers.get'),
  recentTrips: (id: string, limit = 20) =>
    governed(
      adminApi.get(`/admin/drivers/${id}/trips`, { params: { limit } }),
      z.array(adminRecentTripSchema),
      'admin.drivers.recent-trips',
    ),
  bulkSuspend: (ids: string[], reason: string) =>
    governed(
      adminApi.post('/admin/drivers/bulk/suspend', { ids, reason }, idempotencyConfig()),
      affectedResultSchema,
      'admin.drivers.bulk-suspend',
    ),
  bulkActivate: (ids: string[], reason: string) =>
    governed(
      adminApi.post('/admin/drivers/bulk/activate', { ids, reason }, idempotencyConfig()),
      affectedResultSchema,
      'admin.drivers.bulk-activate',
    ),
};

export const tripsApi = {
  list: (params: {
    driverId?: string;
    cursor?: string;
    limit?: number;
    startedAfter?: string;
    startedBefore?: string;
    includeDeleted?: boolean;
  }) => governed(adminApi.get('/admin/trips', { params }), adminTripsPageSchema, 'admin.trips.list'),
  get: (id: string) =>
    governed(adminApi.get(`/admin/trips/${id}`), adminTripDetailSchema, 'admin.trips.get'),
  bulkDelete: (ids: string[], reason: string) =>
    governed(
      adminApi.post('/admin/trips/bulk/delete', { ids, reason }, idempotencyConfig()),
      affectedResultSchema,
      'admin.trips.bulk-delete',
    ),
  bulkRestore: (ids: string[], reason: string) =>
    governed(
      adminApi.post('/admin/trips/bulk/restore', { ids, reason }, idempotencyConfig()),
      affectedResultSchema,
      'admin.trips.bulk-restore',
    ),
};

export const vehiclesApi = {
  list: (params: { type?: string; isActive?: boolean; cursor?: string; limit?: number }) =>
    governed(adminApi.get('/admin/vehicles', { params }), adminVehiclesPageSchema, 'admin.vehicles.list'),
  get: (id: string) =>
    governed(adminApi.get(`/admin/vehicles/${id}`), adminEntitySchema, 'admin.vehicles.get'),
  bulkDelete: (ids: string[], reason: string) =>
    governed(
      adminApi.post('/admin/vehicles/bulk/delete', { ids, reason }, idempotencyConfig()),
      affectedResultSchema,
      'admin.vehicles.bulk-delete',
    ),
};

export const communityApi = {
  list: (params: { isHidden?: boolean; cursor?: string; limit?: number }) =>
    governed(adminApi.get('/admin/community/posts', { params }), communityPageSchema, 'admin.community.posts.list'),
  get: (id: string) =>
    governed(adminApi.get(`/admin/community/posts/${id}`), adminEntitySchema, 'admin.community.posts.get'),
  hide: (id: string) =>
    governed(
      adminApi.post(`/admin/community/posts/${id}/hide`, {}, idempotencyConfig()),
      adminCommunityPostStateSchema,
      'admin.community.posts.hide',
    ),
  unhide: (id: string) =>
    governed(
      adminApi.post(`/admin/community/posts/${id}/unhide`, {}, idempotencyConfig()),
      adminCommunityPostStateSchema,
      'admin.community.posts.unhide',
    ),
  remove: (id: string, reason: string) =>
    governed(
      adminApi.delete(`/admin/community/posts/${id}`, {
        data: { reason },
        ...idempotencyConfig(),
      }),
      okResultSchema,
      'admin.community.posts.delete',
    ),
  bulkDelete: (ids: string[], reason: string) =>
    governed(
      adminApi.post('/admin/community/posts/bulk/delete', { ids, reason }, idempotencyConfig()),
      affectedResultSchema,
      'admin.community.posts.bulk-delete',
    ),
};

export const reviewsApi = {
  list: (params: { isApproved?: boolean; isFeatured?: boolean; cursor?: string; limit?: number }) =>
    governed(adminApi.get('/admin/reviews', { params }), reviewsPageSchema, 'admin.reviews.list'),
  summary: () =>
    governed(adminApi.get('/admin/reviews/summary'), adminReviewsSummarySchema, 'admin.reviews.summary'),
  approve: (id: string) =>
    governed(
      adminApi.post(`/admin/reviews/${id}/approve`, {}, idempotencyConfig()),
      adminReviewStateSchema,
      'admin.reviews.approve',
    ),
  unapprove: (id: string) =>
    governed(
      adminApi.post(`/admin/reviews/${id}/unapprove`, {}, idempotencyConfig()),
      adminReviewStateSchema,
      'admin.reviews.unapprove',
    ),
  feature: (id: string) =>
    governed(
      adminApi.post(`/admin/reviews/${id}/feature`, {}, idempotencyConfig()),
      adminReviewStateSchema,
      'admin.reviews.feature',
    ),
  unfeature: (id: string) =>
    governed(
      adminApi.post(`/admin/reviews/${id}/unfeature`, {}, idempotencyConfig()),
      adminReviewStateSchema,
      'admin.reviews.unfeature',
    ),
  remove: (id: string, reason: string) =>
    governed(
      adminApi.delete(`/admin/reviews/${id}`, { data: { reason }, ...idempotencyConfig() }),
      okResultSchema,
      'admin.reviews.delete',
    ),
  bulkDelete: (ids: string[], reason: string) =>
    governed(
      adminApi.post('/admin/reviews/bulk/delete', { ids, reason }, idempotencyConfig()),
      affectedResultSchema,
      'admin.reviews.bulk-delete',
    ),
};

export const supportApi = {
  list: (params: { status?: string; category?: string; cursor?: string; limit?: number }) =>
    governed(adminApi.get('/admin/support/tickets', { params }), supportPageSchema, 'admin.support.tickets.list'),
  summary: () =>
    governed(adminApi.get('/admin/support/summary'), adminSupportSummarySchema, 'admin.support.summary'),
  get: (id: string) =>
    governed(
      adminApi.get(`/admin/support/tickets/${id}`),
      adminSupportTicketDetailSchema,
      'admin.support.tickets.get',
    ),
  transition: (id: string, status: string, reason?: string) =>
    governed(
      adminApi.post(`/admin/support/tickets/${id}/transition`, { status, reason }, idempotencyConfig()),
      adminSupportTransitionSchema,
      'admin.support.tickets.transition',
    ),
  note: (id: string, adminNote: string) =>
    governed(
      adminApi.post(`/admin/support/tickets/${id}/note`, { adminNote }, idempotencyConfig()),
      adminSupportNoteSchema,
      'admin.support.tickets.note',
    ),
  bulkTransition: (ids: string[], status: string, reason: string) =>
    governed(
      adminApi.post('/admin/support/tickets/bulk/transition', { ids, status, reason }, idempotencyConfig()),
      affectedResultSchema,
      'admin.support.tickets.bulk-transition',
    ),
  bulkDelete: (ids: string[], reason: string) =>
    governed(
      adminApi.post('/admin/support/tickets/bulk/delete', { ids, reason }, idempotencyConfig()),
      affectedResultSchema,
      'admin.support.tickets.bulk-delete',
    ),
};

export const notificationsApi = {
  alerts: (params: { severity?: string; resolved?: boolean; cursor?: string; limit?: number }) =>
    governed(adminApi.get('/admin/notifications/alerts', { params }), alertsPageSchema, 'admin.notifications.alerts'),
  outbound: (params: { cursor?: string; limit?: number }) =>
    governed(adminApi.get('/admin/notifications/outbound', { params }), outboundPageSchema, 'admin.notifications.outbound'),
};

export const auditApi = {
  list: (params: {
    actorAdminId?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    cursor?: string;
    limit?: number;
  }) => governed(adminApi.get('/admin/audit', { params }), auditPageSchema, 'admin.audit.list'),
  actions: () =>
    governed(adminApi.get('/admin/audit/actions'), z.array(adminAuditActionSchema), 'admin.audit.actions'),
  get: (id: string) =>
    governed(adminApi.get(`/admin/audit/${id}`), adminEntitySchema, 'admin.audit.get'),
};

export const rolesApi = {
  roles: () => governed(adminApi.get('/admin/roles'), z.array(adminRoleSchema), 'admin.roles.list'),
  permissions: () =>
    governed(adminApi.get('/admin/permissions'), z.array(adminPermissionSchema), 'admin.permissions.list'),
  admins: () =>
    governed(adminApi.get('/admin/admins'), z.array(adminAccountSchema), 'admin.admins.list'),
  createAdmin: (body: { email: string; password: string; displayName: string; roleCodes: string[] }) =>
    governed(adminApi.post('/admin/admins', body, idempotencyConfig()), createdAdminSchema, 'admin.admins.create'),
  deleteAdmin: (id: string) =>
    governed(adminApi.delete(`/admin/admins/${id}`, idempotencyConfig()), okResultSchema, 'admin.admins.delete'),
  setAdminActive: (id: string, isActive: boolean) =>
    governed(
      adminApi.patch(`/admin/admins/${id}/active`, { isActive }, idempotencyConfig()),
      adminActiveStateSchema,
      'admin.admins.set-active',
    ),
  updateRolePermissions: (id: string, permissions: string[]) =>
    governed(
      adminApi.patch(`/admin/roles/${id}/permissions`, { permissions }, idempotencyConfig()),
      adminRolePermissionsSchema,
      'admin.roles.update-permissions',
    ),
};

export const settingsApi = {
  list: () =>
    governed(adminApi.get('/admin/settings'), z.array(adminSettingListSchema), 'admin.settings.list'),
  update: (key: string, value: unknown) =>
    governed(
      adminApi.patch(`/admin/settings/${encodeURIComponent(key)}`, { value }, idempotencyConfig()),
      adminSettingSchema,
      'admin.settings.update',
    ),
};

export const analyticsApi = {
  overview: () =>
    governed(adminApi.get('/admin/analytics/overview'), adminAnalyticsOverviewSchema, 'admin.analytics.overview'),
};

export const miscApi = {
  revenue: () =>
    governed(adminApi.get('/admin/revenue/overview'), pendingSchemaNoticeSchema, 'admin.revenue.overview'),
  health: () =>
    governed(adminApi.get('/admin/health/snapshot'), adminHealthSnapshotSchema, 'admin.health.snapshot'),
};
