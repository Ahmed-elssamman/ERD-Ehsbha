import { api, unwrap } from './client';

export interface AuthUser {
  id: string;
  phone: string;
  locale: 'ar' | 'en';
  timezone: string;
  driverId: string | null;
}

export interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export const Auth = {
  register: (body: { phone: string; password: string; displayName: string }) =>
    api.post('/auth/register', body).then((r) => unwrap<AuthResult>(r.data)),
  login: (body: { phone: string; password: string; deviceId?: string }) =>
    api.post('/auth/login', body).then((r) => unwrap<AuthResult>(r.data)),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }).then((r) => unwrap<AuthResult>(r.data)),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }).then((r) => unwrap<void>(r.data)),
};

export const Vehicles = {
  list: () => api.get('/vehicles').then((r) => unwrap<any[]>(r.data)),
  create: (body: any) => api.post('/vehicles', body).then((r) => unwrap<any>(r.data)),
  update: (id: string, body: any) => api.patch(`/vehicles/${id}`, body).then((r) => unwrap<any>(r.data)),
  remove: (id: string) => api.delete(`/vehicles/${id}`),
};

export const Apps = {
  catalog: () => api.get('/apps').then((r) => unwrap<any[]>(r.data)),
  mine: () => api.get('/drivers/me/apps').then((r) => unwrap<any[]>(r.data)),
  add: (body: any) => api.post('/drivers/me/apps', body).then((r) => unwrap<any>(r.data)),
  update: (id: string, body: any) =>
    api.patch(`/drivers/me/apps/${id}`, body).then((r) => unwrap<any>(r.data)),
  remove: (id: string) => api.delete(`/drivers/me/apps/${id}`),
};

export const Areas = {
  list: () => api.get('/areas').then((r) => unwrap<any[]>(r.data)),
  create: (body: any) => api.post('/areas', body).then((r) => unwrap<any>(r.data)),
  update: (id: string, body: any) => api.patch(`/areas/${id}`, body).then((r) => unwrap<any>(r.data)),
  remove: (id: string) => api.delete(`/areas/${id}`),
};

export interface TripInput {
  vehicleId: string;
  driverAppId: string;
  areaId?: string | null;
  startedAt: string;
  endedAt: string;
  grossPiastres: number;
  tipPiastres: number;
  commissionPiastres: number;
  totalKmMeters: number;
  paidKmMeters: number;
  notes?: string | null;
  clientMutationId?: string;
}

export const Trips = {
  list: (params?: { from?: string; to?: string; appId?: string; areaId?: string; cursor?: string; limit?: number }) =>
    api.get('/trips', { params }).then((r) => unwrap<{ items: any[]; nextCursor: string | null }>(r.data)),
  get: (id: string) => api.get(`/trips/${id}`).then((r) => unwrap<any>(r.data)),
  create: (body: TripInput) => api.post('/trips', body).then((r) => unwrap<any>(r.data)),
  update: (id: string, body: Partial<TripInput>) =>
    api.patch(`/trips/${id}`, body).then((r) => unwrap<any>(r.data)),
  remove: (id: string) => api.delete(`/trips/${id}`),
};

export const Sessions = {
  open: () => api.get('/sessions/open').then((r) => unwrap<any>(r.data)),
  start: (body: any) => api.post('/sessions/start', body).then((r) => unwrap<any>(r.data)),
  end: (id: string, body: any = {}) => api.post(`/sessions/${id}/end`, body).then((r) => unwrap<any>(r.data)),
  list: (params?: any) => api.get('/sessions', { params }).then((r) => unwrap<any[]>(r.data)),
};

export const Fuel = {
  list: (params?: any) => api.get('/fuel', { params }).then((r) => unwrap<any[]>(r.data)),
  create: (body: any) => api.post('/fuel', body).then((r) => unwrap<any>(r.data)),
  update: (id: string, body: any) => api.patch(`/fuel/${id}`, body).then((r) => unwrap<any>(r.data)),
  remove: (id: string) => api.delete(`/fuel/${id}`),
};

export const Expenses = {
  list: (params?: any) => api.get('/expenses', { params }).then((r) => unwrap<any[]>(r.data)),
  create: (body: any) => api.post('/expenses', body).then((r) => unwrap<any>(r.data)),
  update: (id: string, body: any) => api.patch(`/expenses/${id}`, body).then((r) => unwrap<any>(r.data)),
  remove: (id: string) => api.delete(`/expenses/${id}`),
};

export const Maintenance = {
  items: () => api.get('/maintenance/items').then((r) => unwrap<any[]>(r.data)),
  records: (vehicleId: string) =>
    api.get(`/vehicles/${vehicleId}/maintenance/records`).then((r) => unwrap<any[]>(r.data)),
  addRecord: (vehicleId: string, body: any) =>
    api.post(`/vehicles/${vehicleId}/maintenance/records`, body).then((r) => unwrap<any>(r.data)),
  risk: (vehicleId: string) =>
    api.get(`/vehicles/${vehicleId}/maintenance/risk`).then((r) => unwrap<any[]>(r.data)),
};

export const Goals = {
  list: () => api.get('/goals').then((r) => unwrap<any[]>(r.data)),
  create: (body: any) => api.post('/goals', body).then((r) => unwrap<any>(r.data)),
  update: (id: string, body: any) => api.patch(`/goals/${id}`, body).then((r) => unwrap<any>(r.data)),
  remove: (id: string) => api.delete(`/goals/${id}`),
  progress: (id: string) => api.get(`/goals/${id}/progress`).then((r) => unwrap<any>(r.data)),
};

export const Analytics = {
  today: () => api.get('/analytics/today').then((r) => unwrap<any>(r.data)),
  daily: (date?: string) => api.get('/analytics/daily', { params: { date } }).then((r) => unwrap<any>(r.data)),
  weekly: (isoYear: number, isoWeek: number) =>
    api.get('/analytics/weekly', { params: { isoYear, isoWeek } }).then((r) => unwrap<any>(r.data)),
  monthly: (year: number, month: number) =>
    api.get('/analytics/monthly', { params: { year, month } }).then((r) => unwrap<any>(r.data)),
  apps: (window = '7d') => api.get('/analytics/apps', { params: { window } }).then((r) => unwrap<any>(r.data)),
  areas: (window = '7d') => api.get('/analytics/areas', { params: { window } }).then((r) => unwrap<any>(r.data)),
  hours: (window = '7d') => api.get('/analytics/hours', { params: { window } }).then((r) => unwrap<any>(r.data)),
  forecast: () => api.get('/analytics/forecast/monthly').then((r) => unwrap<any>(r.data)),
};

export const Recommendations = {
  list: () => api.get('/recommendations').then((r) => unwrap<any[]>(r.data)),
  dismiss: (id: string) => api.post(`/recommendations/${id}/dismiss`),
  today: () => api.get('/decisions/today').then((r) => unwrap<any[]>(r.data)),
};

export const Score = {
  today: () => api.get('/score/today').then((r) => unwrap<any>(r.data)),
  history: () => api.get('/score/history').then((r) => unwrap<any[]>(r.data)),
};

export const Notifications = {
  list: () => api.get('/notifications').then((r) => unwrap<{ items: any[]; nextCursor: string | null }>(r.data)),
  read: (id: string) => api.post(`/notifications/${id}/read`),
  registerDevice: (token: string, platform: 'ios' | 'android' | 'web') =>
    api.post('/notifications/devices', { token, platform }),
};

export const Driver = {
  me: () => api.get('/drivers/me').then((r) => unwrap<any>(r.data)),
  update: (body: any) => api.patch('/drivers/me', body).then((r) => unwrap<any>(r.data)),
};
