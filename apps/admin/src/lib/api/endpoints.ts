import { adminApi } from './admin-client';

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export const usersApi = {
  list: (params: { search?: string; status?: string; cursor?: string; limit?: number }) =>
    adminApi.get('/admin/users', { params }).then((r) => r.data),
  get: (id: string) => adminApi.get(`/admin/users/${id}`).then((r) => r.data),
  suspend: (id: string, reason: string, reasonCode: string) =>
    adminApi.post(`/admin/users/${id}/suspend`, { reason, reasonCode }).then((r) => r.data),
  activate: (id: string, reason: string, reasonCode: string) =>
    adminApi.post(`/admin/users/${id}/activate`, { reason, reasonCode }).then((r) => r.data),
  bulkSuspend: (ids: string[], reason: string) =>
    adminApi.post('/admin/users/bulk/suspend', { ids, reason }).then((r) => r.data),
  bulkActivate: (ids: string[], reason: string) =>
    adminApi.post('/admin/users/bulk/activate', { ids, reason }).then((r) => r.data),
  bulkDelete: (ids: string[], reason: string) =>
    adminApi.post('/admin/users/bulk/delete', { ids, reason }).then((r) => r.data),
};

export const driversApi = {
  list: (params: { search?: string; cursor?: string; limit?: number }) =>
    adminApi.get('/admin/drivers', { params }).then((r) => r.data),
  get: (id: string) => adminApi.get(`/admin/drivers/${id}`).then((r) => r.data),
  recentTrips: (id: string, limit = 20) =>
    adminApi.get(`/admin/drivers/${id}/trips`, { params: { limit } }).then((r) => r.data),
  bulkSuspend: (ids: string[], reason: string) =>
    adminApi.post('/admin/drivers/bulk/suspend', { ids, reason }).then((r) => r.data),
  bulkActivate: (ids: string[], reason: string) =>
    adminApi.post('/admin/drivers/bulk/activate', { ids, reason }).then((r) => r.data),
};

export const tripsApi = {
  list: (params: { driverId?: string; cursor?: string; limit?: number; startedAfter?: string; startedBefore?: string; includeDeleted?: boolean }) =>
    adminApi.get('/admin/trips', { params }).then((r) => r.data),
  get: (id: string) => adminApi.get(`/admin/trips/${id}`).then((r) => r.data),
  bulkDelete: (ids: string[], reason: string) =>
    adminApi.post('/admin/trips/bulk/delete', { ids, reason }).then((r) => r.data),
  bulkRestore: (ids: string[], reason: string) =>
    adminApi.post('/admin/trips/bulk/restore', { ids, reason }).then((r) => r.data),
};

export const vehiclesApi = {
  list: (params: { type?: string; isActive?: boolean; cursor?: string; limit?: number }) =>
    adminApi.get('/admin/vehicles', { params }).then((r) => r.data),
  get: (id: string) => adminApi.get(`/admin/vehicles/${id}`).then((r) => r.data),
  bulkDelete: (ids: string[], reason: string) =>
    adminApi.post('/admin/vehicles/bulk/delete', { ids, reason }).then((r) => r.data),
};

export const communityApi = {
  list: (params: { isHidden?: boolean; cursor?: string; limit?: number }) =>
    adminApi.get('/admin/community/posts', { params }).then((r) => r.data),
  get: (id: string) => adminApi.get(`/admin/community/posts/${id}`).then((r) => r.data),
  hide: (id: string) => adminApi.post(`/admin/community/posts/${id}/hide`).then((r) => r.data),
  unhide: (id: string) => adminApi.post(`/admin/community/posts/${id}/unhide`).then((r) => r.data),
  remove: (id: string, reason: string) =>
    adminApi.delete(`/admin/community/posts/${id}`, { data: { reason } }).then((r) => r.data),
  bulkDelete: (ids: string[], reason: string) =>
    adminApi.post('/admin/community/posts/bulk/delete', { ids, reason }).then((r) => r.data),
};

export const reviewsApi = {
  list: (params: { isApproved?: boolean; isFeatured?: boolean; cursor?: string; limit?: number }) =>
    adminApi.get('/admin/reviews', { params }).then((r) => r.data),
  summary: () => adminApi.get('/admin/reviews/summary').then((r) => r.data),
  approve: (id: string) => adminApi.post(`/admin/reviews/${id}/approve`).then((r) => r.data),
  unapprove: (id: string) => adminApi.post(`/admin/reviews/${id}/unapprove`).then((r) => r.data),
  feature: (id: string) => adminApi.post(`/admin/reviews/${id}/feature`).then((r) => r.data),
  unfeature: (id: string) => adminApi.post(`/admin/reviews/${id}/unfeature`).then((r) => r.data),
  remove: (id: string, reason: string) =>
    adminApi.delete(`/admin/reviews/${id}`, { data: { reason } }).then((r) => r.data),
  bulkDelete: (ids: string[], reason: string) =>
    adminApi.post('/admin/reviews/bulk/delete', { ids, reason }).then((r) => r.data),
};

export const supportApi = {
  list: (params: { status?: string; category?: string; cursor?: string; limit?: number }) =>
    adminApi.get('/admin/support/tickets', { params }).then((r) => r.data),
  summary: () => adminApi.get('/admin/support/summary').then((r) => r.data),
  get: (id: string) => adminApi.get(`/admin/support/tickets/${id}`).then((r) => r.data),
  transition: (id: string, status: string, reason?: string) =>
    adminApi.post(`/admin/support/tickets/${id}/transition`, { status, reason }).then((r) => r.data),
  note: (id: string, adminNote: string) =>
    adminApi.post(`/admin/support/tickets/${id}/note`, { adminNote }).then((r) => r.data),
  bulkTransition: (ids: string[], status: string, reason: string) =>
    adminApi.post('/admin/support/tickets/bulk/transition', { ids, status, reason }).then((r) => r.data),
  bulkDelete: (ids: string[], reason: string) =>
    adminApi.post('/admin/support/tickets/bulk/delete', { ids, reason }).then((r) => r.data),
};

export const notificationsApi = {
  alerts: (params: { severity?: string; resolved?: boolean; cursor?: string; limit?: number }) =>
    adminApi.get('/admin/notifications/alerts', { params }).then((r) => r.data),
  outbound: (params: { cursor?: string; limit?: number }) =>
    adminApi.get('/admin/notifications/outbound', { params }).then((r) => r.data),
};

export const auditApi = {
  list: (params: { actorAdminId?: string; action?: string; targetType?: string; targetId?: string; cursor?: string; limit?: number }) =>
    adminApi.get('/admin/audit', { params }).then((r) => r.data),
  actions: () => adminApi.get('/admin/audit/actions').then((r) => r.data),
  get: (id: string) => adminApi.get(`/admin/audit/${id}`).then((r) => r.data),
};

export const rolesApi = {
  roles: () => adminApi.get('/admin/roles').then((r) => r.data),
  permissions: () => adminApi.get('/admin/permissions').then((r) => r.data),
  admins: () => adminApi.get('/admin/admins').then((r) => r.data),
  createAdmin: (body: { email: string; password: string; displayName: string; roleCodes: string[] }) =>
    adminApi.post('/admin/admins', body).then((r) => r.data),
  deleteAdmin: (id: string) => adminApi.delete(`/admin/admins/${id}`).then((r) => r.data),
  setAdminActive: (id: string, isActive: boolean) =>
    adminApi.patch(`/admin/admins/${id}/active`, { isActive }).then((r) => r.data),
  updateRolePermissions: (id: string, permissions: string[]) =>
    adminApi.patch(`/admin/roles/${id}/permissions`, { permissions }).then((r) => r.data),
};

export const settingsApi = {
  list: () => adminApi.get('/admin/settings').then((r) => r.data),
  update: (key: string, value: unknown) =>
    adminApi.patch(`/admin/settings/${encodeURIComponent(key)}`, { value }).then((r) => r.data),
};

export const analyticsApi = {
  overview: () => adminApi.get('/admin/analytics/overview').then((r) => r.data),
};

export const miscApi = {
  revenue: () => adminApi.get('/admin/revenue/overview').then((r) => r.data),
  health: () => adminApi.get('/admin/health/snapshot').then((r) => r.data),
};
