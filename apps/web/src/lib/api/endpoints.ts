import axios, { type AxiosResponse } from 'axios';
import { z } from 'zod';
import {
  appNotificationSchema,
  EmptySuccessDataSchema,
  appPerformanceSchema,
  areaPerformanceSchema,
  batchCreateTripsResponseSchema,
  batchDeleteTripsResponseSchema,
  communityListResponseSchema,
  dailyAnalyticsSchema,
  dailyDigestDataSchema,
  decisionCardSchema,
  driverAppBindingSchema,
  driverAppSourceSchema,
  driverAreaSchema,
  driverAuthResultSchema,
  driverAuthUserSchema,
  driverCommunityPostSchema,
  driverExpenseSchema,
  driverFuelEntrySchema,
  driverGoalSchema,
  driverMeSchema,
  driverScoreSchema,
  driverSupportTicketSchema,
  driverVehicleSchema,
  forgotPasswordResultSchema,
  goalProgressSchema,
  hourBucketSchema,
  lookupEmailResultSchema,
  maintenanceItemSchema,
  maintenanceRecordSchema,
  maintenanceRiskSchema,
  monthlyAnalyticsSchema,
  monthlyForecastSchema,
  myReviewSchema,
  notificationsListSchema,
  platformReviewSchema,
  reviewsListResponseSchema,
  reviewsSummarySchema,
  supportTicketListResponseSchema,
  tripItemSchema,
  tripsListResponseSchema,
  vehicleCostSummarySchema,
  weeklyAnalyticsSchema,
} from '@ehsbha/api-contracts';
import { generateIdempotencyKey, parseData } from '@/features/platform-api';
import { api, apiBaseUrl } from './client';
// Shared contract schemas available via @ehsbha/api-contracts:
//   auth: driverLoginSchema, driverRefreshSchema, passwordResetSchema, driverProfileSchema
//   vehicles: vehicleSchema, createVehicleSchema, updateVehicleSchema, appSourceSchema, areaSchema
//   trips: tripSchema, createTripSchema, batchTripSchema
//   operations: expenseSchema, createExpenseSchema, fuelEntrySchema, maintenanceSchema, odometerEntrySchema, sessionSchema, goalSchema
//   analytics: analyticsSummarySchema, forecastSchema, recommendationSchema, scoreSchema
//   communications: communityPostSchema, reviewSchema, supportTicketSchema, notificationSchema, publicReviewSchema
//   OCR: ocrRequestSchema, ocrResultSchema (see ocr.api.ts)

/** A vanilla axios instance for endpoints that should not send Authorization. */
const publicApi = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

const parseEnvelope = <S extends z.ZodTypeAny>(schema: S, operationId: string) =>
  (response: AxiosResponse<unknown>): z.output<S> => parseData(schema, response.data, operationId);

const idempotencyConfig = (key = generateIdempotencyKey()) => ({
  headers: { 'Idempotency-Key': key },
});

/* -------- Auth ---------------------------------------------------------- */

export interface AuthUser {
  id: string;
  phone: string;
  email?: string | null;
  locale: 'ar' | 'en';
  timezone: string;
  driverId: string | null;
}

export interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface ForgotResult {
  sent: boolean;
  channel: 'email' | 'sms' | 'none';
  /** Masked email the code was sent to (e.g. "m***a@gmail.com"). */
  emailMasked: string;
  expiresInMinutes: number;
  /** Returned only in dev mode so the flow can be exercised without real email/SMS. */
  devCode?: string;
}

export interface LookupEmailResult {
  phone: string;
  /** Masked email registered to the phone (e.g. "m***a@gmail.com"). */
  emailMasked: string;
}

export const AuthApi = {
  register: (body: {
    phone: string;
    email: string;
    password: string;
    displayName: string;
    locale?: 'ar' | 'en';
    timezone?: string;
  }) => api.post('/auth/register', body).then(parseEnvelope(driverAuthResultSchema, 'driver.auth.register')),
  login: (body: { phone: string; password: string; deviceId?: string }) =>
    api.post('/auth/login', body).then(parseEnvelope(driverAuthResultSchema, 'driver.auth.login')),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }).then(parseEnvelope(driverAuthResultSchema, 'driver.auth.refresh')),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }).then(parseEnvelope(EmptySuccessDataSchema, 'driver.auth.logout')),
  lookupResetEmail: (body: { phone: string }) =>
    api.post('/auth/password/lookup', body).then(parseEnvelope(lookupEmailResultSchema, 'driver.auth.password-lookup')),
  forgotPassword: (body: { phone: string }) =>
    api.post('/auth/password/forgot', body).then(parseEnvelope(forgotPasswordResultSchema, 'driver.auth.password-forgot')),
  resetPassword: (body: { phone: string; code: string; newPassword: string }) =>
    api.post('/auth/password/reset', body).then(parseEnvelope(EmptySuccessDataSchema, 'driver.auth.password-reset')),
  updateMe: (body: { email?: string | null; locale?: 'ar' | 'en'; timezone?: string }) =>
    api.patch('/me', body).then(parseEnvelope(driverAuthUserSchema, 'driver.users.update-me')),
};

/* -------- Driver -------------------------------------------------------- */

export interface DriverMe {
  id: string;
  displayName: string;
  photoUrl?: string | null;
  baseCity?: string | null;
  monthlyGoalPiastres?: number | null;
}

export const DriverApi = {
  me: () => api.get('/drivers/me').then(parseEnvelope(driverMeSchema, 'driver.drivers.get-me')),
  update: (body: Partial<{ displayName: string; photoUrl: string | null; baseCity: string | null }>) =>
    api.patch('/drivers/me', body).then(parseEnvelope(driverMeSchema, 'driver.drivers.update-me')),
};

/* -------- Vehicles ------------------------------------------------------ */

export type VehicleType = 'CAR' | 'BIKE';
export type FuelType = 'PETROL_80' | 'PETROL_92' | 'PETROL_95' | 'DIESEL' | 'CNG' | 'ELECTRIC';

export interface Vehicle {
  id: string;
  type: VehicleType;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  fuelType: FuelType;
  tankLiters: number;
  baselineKmPerLiter: number;
  odometerMeters: number;
  isActive: boolean;
  // Cost components (nullable)
  fuelTankCostPiastres?: number | null;
  fuelTankKmRange?: number | null;
  oilCostPiastres?: number | null;
  oilIntervalKm?: number | null;
  tireCostPiastres?: number | null;
  tireIntervalKm?: number | null;
  brakesCostPiastres?: number | null;
  brakesIntervalKm?: number | null;
  chainCostPiastres?: number | null;
  chainIntervalKm?: number | null;
  batteryCostPiastres?: number | null;
  batteryIntervalMonths?: number | null;
  monthlyMaintCostPiastres?: number | null;
  monthlyAvgKm?: number | null;
}

export interface VehicleCostSummary {
  totalPerKmPiastres: number;
  monthlyAvgKm?: number;
  completenessBp: number;
  components: Array<{
    key: string;
    perKmPiastres: number;
    shareBp: number;
    provided: boolean;
  }>;
}

export const VehiclesApi = {
  list: () => api.get('/vehicles').then(parseEnvelope(driverVehicleSchema.array(), 'driver.vehicles.list')),
  get: (id: string) => api.get(`/vehicles/${id}`).then(parseEnvelope(driverVehicleSchema, 'driver.vehicles.get')),
  create: (body: Partial<Vehicle> & { type: VehicleType; fuelType: FuelType }) =>
    api.post('/vehicles', body, idempotencyConfig()).then(parseEnvelope(driverVehicleSchema, 'driver.vehicles.create')),
  update: (id: string, body: Partial<Vehicle>) =>
    api.patch(`/vehicles/${id}`, body, idempotencyConfig()).then(parseEnvelope(driverVehicleSchema, 'driver.vehicles.update')),
  updateCosts: (id: string, body: Partial<Vehicle>) =>
    api.patch(`/vehicles/${id}/costs`, body, idempotencyConfig()).then(parseEnvelope(driverVehicleSchema, 'driver.vehicles.update-costs')),
  costSummary: (id: string) =>
    api.get(`/vehicles/${id}/cost-summary`).then(parseEnvelope(vehicleCostSummarySchema, 'driver.vehicles.cost-summary')),
  remove: (id: string) =>
    api.delete(`/vehicles/${id}`, idempotencyConfig())
      .then(parseEnvelope(EmptySuccessDataSchema, 'driver.vehicles.delete')),
};

/* -------- Apps ---------------------------------------------------------- */

export interface AppSource {
  id: string;
  name: string;
  iconUrl?: string | null;
  defaultCommissionPct: number;
}

export interface DriverApp {
  id: string;
  appSourceId: string | null;
  customName: string | null;
  commissionPct: number;
  color: string | null;
  enabled: boolean;
  appSource?: AppSource | null;
}

/** Prisma serialises Decimal as a string ("20"); coerce here so consumers can rely on numbers. */
const coerceAppSource = (a: AppSource): AppSource => ({
  ...a,
  defaultCommissionPct: Number(a.defaultCommissionPct),
});
const coerceDriverApp = (a: DriverApp): DriverApp => ({
  ...a,
  commissionPct: Number(a.commissionPct),
  appSource: a.appSource ? coerceAppSource(a.appSource) : a.appSource,
});

export const AppsApi = {
  catalog: () =>
    api.get('/apps').then(parseEnvelope(driverAppSourceSchema.array(), 'driver.apps.list')).then((items) => items.map(coerceAppSource)),
  mine: () =>
    api.get('/drivers/me/apps').then(parseEnvelope(driverAppBindingSchema.array(), 'driver.apps.list-mine')).then((items) => items.map(coerceDriverApp)),
  add: (body: Partial<DriverApp> & ({ appSourceId: string } | { customName: string })) =>
    api.post('/drivers/me/apps', body, idempotencyConfig()).then(parseEnvelope(driverAppBindingSchema, 'driver.apps.create')).then(coerceDriverApp),
  update: (id: string, body: Partial<DriverApp>) =>
    api.patch(`/drivers/me/apps/${id}`, body, idempotencyConfig()).then(parseEnvelope(driverAppBindingSchema, 'driver.apps.update')).then(coerceDriverApp),
  remove: (id: string) =>
    api.delete(`/drivers/me/apps/${id}`, idempotencyConfig())
      .then(parseEnvelope(EmptySuccessDataSchema, 'driver.apps.delete')),
};

/* -------- Areas --------------------------------------------------------- */

export interface Area {
  id: string;
  name: string;
  color: string | null;
}

export const AreasApi = {
  list: () => api.get('/areas').then(parseEnvelope(driverAreaSchema.array(), 'driver.areas.list')),
  create: (body: { name: string; color?: string }) =>
    api.post('/areas', body, idempotencyConfig()).then(parseEnvelope(driverAreaSchema, 'driver.areas.create')),
  update: (id: string, body: Partial<{ name: string; color: string }>) =>
    api.patch(`/areas/${id}`, body, idempotencyConfig()).then(parseEnvelope(driverAreaSchema, 'driver.areas.update')),
  remove: (id: string) =>
    api.delete(`/areas/${id}`, idempotencyConfig())
      .then(parseEnvelope(EmptySuccessDataSchema, 'driver.areas.delete')),
};

/* -------- Trips --------------------------------------------------------- */

export interface TripItem {
  id: string;
  vehicleId: string;
  driverAppId: string;
  areaId: string | null;
  startedAt: string;
  endedAt: string;
  grossPiastres: number;
  tipPiastres: number;
  commissionPiastres: number;
  tollPiastres?: number;
  parkingPiastres?: number;
  totalKmMeters: number;
  paidKmMeters: number;
  emptyKmMeters: number;
  notes: string | null;
}

export interface TripsListResponse {
  items: TripItem[];
  nextCursor: string | null;
}

export interface CreateTripInput {
  vehicleId: string;
  driverAppId: string;
  areaId?: string | null;
  startedAt: string;
  endedAt: string;
  grossPiastres: number;
  receivedPiastres?: number | null;
  tipPiastres?: number;
  commissionPiastres?: number;
  tollPiastres?: number;
  parkingPiastres?: number;
  totalKmMeters: number;
  paidKmMeters: number;
  notes?: string | null;
  clientMutationId?: string;
}

export interface BatchCreateTripsResponse {
  created: TripItem[];
  errors: Array<{ index: number; code: string; message: string }>;
}
export interface BatchDeleteTripsResponse {
  deleted: string[];
  errors: Array<{ id: string; code: string; message: string }>;
}

export const TripsApi = {
  list: (params?: {
    from?: string;
    to?: string;
    appId?: string;
    areaId?: string;
    cursor?: string;
    limit?: number;
  }) => api.get('/trips', { params }).then(parseEnvelope(tripsListResponseSchema, 'driver.trips.list')),
  get: (id: string) => api.get(`/trips/${id}`).then(parseEnvelope(tripItemSchema, 'driver.trips.get')),
  create: (body: CreateTripInput) =>
    api.post('/trips', body, idempotencyConfig(body.clientMutationId))
      .then(parseEnvelope(tripItemSchema, 'driver.trips.create')),
  /** Bulk-create endpoint backing the OCR multi-trip flow. One request, N
   * trips; the server returns successes and per-index failures separately. */
  createBatch: (items: CreateTripInput[]) =>
    api.post('/trips/batch', { items }, idempotencyConfig())
      .then(parseEnvelope(batchCreateTripsResponseSchema, 'driver.trips.batch')),
  update: (id: string, body: Partial<CreateTripInput>) =>
    api.patch(`/trips/${id}`, body, idempotencyConfig())
      .then(parseEnvelope(tripItemSchema, 'driver.trips.update')),
  remove: (id: string) =>
    api.delete(`/trips/${id}`, idempotencyConfig())
      .then(parseEnvelope(EmptySuccessDataSchema, 'driver.trips.delete')),
  /** Bulk-delete used by the trip list's multi-select toolbar. */
  removeBatch: (ids: string[]) =>
    api.post('/trips/batch-delete', { ids }, idempotencyConfig())
      .then(parseEnvelope(batchDeleteTripsResponseSchema, 'driver.trips.post-batch-delete')),
};

/* -------- Expenses ------------------------------------------------------ */

export type ExpenseCategory =
  | 'RENT'
  | 'INSURANCE'
  | 'FINE'
  | 'TOLL'
  | 'FOOD'
  | 'PHONE'
  | 'WASH'
  | 'PARKING'
  | 'OTHER';

export interface Expense {
  id: string;
  vehicleId: string | null;
  category: ExpenseCategory;
  amountPiastres: number;
  dateTime: string;
  isRecurring: boolean;
  recurrenceRule: string | null;
  notes: string | null;
}

export interface CreateExpenseInput {
  vehicleId?: string | null;
  category: ExpenseCategory;
  amountPiastres: number;
  dateTime: string;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
  notes?: string | null;
}

export const ExpensesApi = {
  list: (params?: { from?: string; to?: string; category?: ExpenseCategory; limit?: number }) =>
    api.get('/expenses', { params }).then(parseEnvelope(driverExpenseSchema.array(), 'driver.expenses.list')),
  create: (body: CreateExpenseInput) =>
    api.post('/expenses', body, idempotencyConfig()).then(parseEnvelope(driverExpenseSchema, 'driver.expenses.create')),
  update: (id: string, body: Partial<CreateExpenseInput>) =>
    api.patch(`/expenses/${id}`, body, idempotencyConfig()).then(parseEnvelope(driverExpenseSchema, 'driver.expenses.update')),
  remove: (id: string) =>
    api.delete(`/expenses/${id}`, idempotencyConfig())
      .then(parseEnvelope(EmptySuccessDataSchema, 'driver.expenses.delete')),
};

/* -------- Fuel ---------------------------------------------------------- */

export interface FuelEntry {
  id: string;
  vehicleId: string;
  liters: number;
  pricePerLiterPiastres: number;
  totalPiastres: number;
  odometerMeters: number;
  isFullTank: boolean;
  filledAt: string;
}

export const FuelApi = {
  list: (params?: { vehicleId?: string; limit?: number }) =>
    api.get('/fuel', { params }).then(parseEnvelope(driverFuelEntrySchema.array(), 'driver.fuel.list')),
  create: (body: Partial<FuelEntry>) =>
    api.post('/fuel', body, idempotencyConfig()).then(parseEnvelope(driverFuelEntrySchema, 'driver.fuel.create')),
};

/* -------- Maintenance --------------------------------------------------- */

export interface MaintenanceItem {
  id: string;
  /** Stable identifier (e.g. ENGINE_OIL) used as the i18n key for the display name. */
  code: string;
  /** English fallback name from the backend catalog. */
  name: string;
  defaultIntervalKm: number | null;
  defaultIntervalDays: number | null;
  appliesToCar: boolean;
  appliesToBike: boolean;
}

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  maintenanceItemId: string;
  performedAt: string;
  odometerMeters: number;
  costPiastres: number;
  notes: string | null;
  maintenanceItem?: MaintenanceItem;
}

export type MaintenanceStatus = 'GREEN' | 'AMBER' | 'RED' | 'OVERDUE';

export interface MaintenanceRiskRow {
  item: MaintenanceItem;
  status: MaintenanceStatus;
  risk: number;
  kmSinceLastMeters: number;
  daysSinceLast: number | null;
  lastServiceAt: string | null;
}

export const MaintenanceApi = {
  items: () => api.get('/maintenance/items').then(parseEnvelope(maintenanceItemSchema.array(), 'driver.maintenance.items')),
  records: (vehicleId: string) =>
    api.get(`/vehicles/${vehicleId}/maintenance/records`)
      .then(parseEnvelope(maintenanceRecordSchema.array(), 'driver.vehicles.maintenance-records')),
  addRecord: (vehicleId: string, body: { maintenanceItemId: string; performedAt: string; odometerMeters: number; costPiastres: number; notes?: string | null }) =>
    api.post(`/vehicles/${vehicleId}/maintenance/records`, body, idempotencyConfig())
      .then(parseEnvelope(maintenanceRecordSchema, 'driver.vehicles.create-maintenance-record')),
  risk: (vehicleId: string) =>
    api.get(`/vehicles/${vehicleId}/maintenance/risk`)
      .then(parseEnvelope(maintenanceRiskSchema.array(), 'driver.vehicles.maintenance-risk')),
};

/* -------- Goals --------------------------------------------------------- */

export type GoalPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type GoalStatus = 'ON_TRACK' | 'LAGGING' | 'AT_RISK' | 'ACHIEVED';

export interface Goal {
  id: string;
  period: GoalPeriod;
  targetPiastres: number;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
}

export interface GoalProgress {
  goal: Goal;
  currentNetPiastres: number;
  forecastNetPiastres: number;
  elapsedDays: number;
  totalDays: number;
  progressBp: number;
  status: GoalStatus;
}

export const GoalsApi = {
  list: () => api.get('/goals').then(parseEnvelope(driverGoalSchema.array(), 'driver.goals.list')),
  create: (body: { period: GoalPeriod; targetPiastres: number; startsOn: string; endsOn: string }) =>
    api.post('/goals', body, idempotencyConfig()).then(parseEnvelope(driverGoalSchema, 'driver.goals.create')),
  update: (id: string, body: Partial<Goal>) =>
    api.patch(`/goals/${id}`, body, idempotencyConfig()).then(parseEnvelope(driverGoalSchema, 'driver.goals.update')),
  remove: (id: string) =>
    api.delete(`/goals/${id}`, idempotencyConfig())
      .then(parseEnvelope(EmptySuccessDataSchema, 'driver.goals.delete')),
  progress: (id: string) => api.get(`/goals/${id}/progress`).then(parseEnvelope(goalProgressSchema, 'driver.goals.progress')),
};

/* -------- Analytics ----------------------------------------------------- */

export interface DailyAnalytics {
  date: string | Date;
  tripCount: number;
  totalKmMeters: number;
  paidKmMeters: number;
  emptyKmMeters: number;
  onlineMinutes: number;
  grossPiastres: number;
  fuelPiastres: number;
  expensePiastres: number;
  netProfitPiastres: number;
  profitPerKmPiastres: number;
  profitPerHourPiastres: number;
  emptyRatioBp: number;
}

export interface WeeklyAnalytics {
  isoYear: number;
  isoWeek: number;
  tripCount: number;
  totalKmMeters?: number;
  paidKmMeters?: number;
  emptyKmMeters?: number;
  onlineMinutes?: number;
  grossPiastres?: number;
  netProfitPiastres: number;
  fuelPiastres?: number;
  expensePiastres?: number;
  profitPerKmPiastres?: number;
  profitPerHourPiastres?: number;
  emptyRatioBp?: number;
}

export interface MonthlyAnalytics {
  year: number;
  month: number;
  tripCount: number;
  totalKmMeters?: number;
  paidKmMeters?: number;
  emptyKmMeters?: number;
  onlineMinutes?: number;
  grossPiastres?: number;
  netProfitPiastres: number;
  fuelPiastres?: number;
  expensePiastres?: number;
  profitPerKmPiastres?: number;
  profitPerHourPiastres?: number;
  emptyRatioBp?: number;
}

export interface AppPerformanceRow {
  driverAppId: string;
  appName: string;
  color: string | null;
  tripCount: number;
  netProfitPiastres: number;
  grossPiastres: number;
  totalKmMeters: number;
  onlineMinutes: number;
  profitPerKmPiastres: number;
  profitPerHourPiastres: number;
}

export interface AreaPerformanceRow {
  areaId: string;
  name: string;
  color: string | null;
  tripCount: number;
  netProfitPiastres: number;
  grossPiastres: number;
  totalKmMeters: number;
  profitPerKmPiastres: number;
}

export interface HourBucketRow {
  bucket: 'morning' | 'afternoon' | 'evening' | 'night';
  tripCount: number;
  netProfitPiastres: number;
  totalKmMeters: number;
  profitPerKmPiastres: number;
}

export interface MonthlyForecast {
  year: number;
  month: number;
  currentNetPiastres: number;
  forecastNetPiastres: number;
  confidenceBandPiastres: number;
  elapsedDays: number;
  totalDays: number;
}

export const AnalyticsApi = {
  today: () => api.get('/analytics/today').then(parseEnvelope(dailyAnalyticsSchema, 'driver.analytics.today')),
  daily: (date?: string) =>
    api.get('/analytics/daily', { params: date ? { date } : undefined })
      .then(parseEnvelope(dailyAnalyticsSchema, 'driver.analytics.daily')),
  weekly: (isoYear: number, isoWeek: number) =>
    api.get('/analytics/weekly', { params: { isoYear, isoWeek } })
      .then(parseEnvelope(weeklyAnalyticsSchema, 'driver.analytics.weekly')),
  monthly: (year: number, month: number) =>
    api.get('/analytics/monthly', { params: { year, month } })
      .then(parseEnvelope(monthlyAnalyticsSchema, 'driver.analytics.monthly')),
  apps: (window = '7d') =>
    api.get('/analytics/apps', { params: { window } }).then(parseEnvelope(
      z.object({ windowDays: z.number(), items: z.array(appPerformanceSchema) }).passthrough(),
      'driver.analytics.apps',
    )),
  areas: (window = '7d') =>
    api.get('/analytics/areas', { params: { window } }).then(parseEnvelope(
      z.object({ windowDays: z.number(), items: z.array(areaPerformanceSchema) }).passthrough(),
      'driver.analytics.areas',
    )),
  hours: (window = '7d') =>
    api.get('/analytics/hours', { params: { window } }).then(parseEnvelope(
      z.object({ windowDays: z.number(), items: z.array(hourBucketSchema) }).passthrough(),
      'driver.analytics.hours',
    )),
  forecastMonthly: () =>
    api.get('/analytics/forecast/monthly').then(parseEnvelope(monthlyForecastSchema, 'driver.analytics.forecast-monthly')),
};

/* -------- Recommendations / Decisions ---------------------------------- */

export interface DecisionCard {
  id: string;
  surface: string;
  type: string;
  tone?: string;
  title: string;
  body?: string;
  actionLabel?: string;
  actionRoute?: string;
  priority?: number;
}

export const RecommendationsApi = {
  list: (surface = 'home') =>
    api.get('/recommendations', { params: { surface } })
      .then(parseEnvelope(decisionCardSchema.array(), 'driver.recommendations.list')),
  dismiss: (id: string) =>
    api.post(`/recommendations/${id}/dismiss`, {}, idempotencyConfig())
      .then(parseEnvelope(EmptySuccessDataSchema, 'driver.recommendations.dismiss')),
  todaysDecisions: () =>
    api.get('/decisions/today').then(parseEnvelope(decisionCardSchema.array(), 'driver.decisions.today')),
};

/* -------- Score --------------------------------------------------------- */

export interface DriverScore {
  date: string;
  overall: number;
  efficiency: number;
  profit: number;
  safety: number;
  consistency: number;
}

export const ScoreApi = {
  today: () => api.get('/score/today').then(parseEnvelope(driverScoreSchema.nullable(), 'driver.score.today')),
  history: (params?: { from?: string; to?: string }) =>
    api.get('/score/history', { params }).then(parseEnvelope(driverScoreSchema.array(), 'driver.score.history')),
};

/* -------- Notifications ------------------------------------------------- */

export interface AppNotification {
  id: string;
  channel: string;
  title: string;
  body: string;
  sentAt: string;
  readAt: string | null;
  data?: Record<string, unknown> | null;
}

export type DailyDigestData = z.infer<typeof dailyDigestDataSchema>;

export const NotificationsApi = {
  list: (params?: { cursor?: string; limit?: number }) =>
    api.get('/notifications', { params }).then(parseEnvelope(notificationsListSchema, 'driver.notifications.list')),
  markRead: (id: string) =>
    api.post(`/notifications/${id}/read`, {}, idempotencyConfig())
      .then(parseEnvelope(appNotificationSchema, 'driver.notifications.mark-read')),
  /** Dev / onboarding helper: triggers today's digest synchronously and
   * stores it as an in-app notification. Returns the new id. */
  triggerDailyDigest: () =>
    api.post('/notifications/daily-digest/me', {}, idempotencyConfig()).then(parseEnvelope(
      z.object({ notificationId: z.string() }).passthrough(),
      'driver.notifications.daily-digest',
    )),
};

/* -------- Community ----------------------------------------------------- */

export type CommunityCategory =
  | 'BEST_APPS'
  | 'EXPERIENCE_UBER'
  | 'EXPERIENCE_INDRIVE'
  | 'EXPERIENCE_DIDI'
  | 'EXPERIENCE_OTHER'
  | 'FUEL_SAVING'
  | 'BEST_HOURS'
  | 'MAINTENANCE_ADVICE'
  | 'EFFICIENCY_TIPS'
  | 'OPERATIONAL_MISTAKES'
  | 'WEEKLY_LESSON'
  | 'SAFETY_ADVICE'
  | 'GENERAL';

export type CommunitySort = 'latest' | 'trending' | 'top';
export type ReactionKind = 'LIKE' | 'DISLIKE';

export interface CommunityPostAuthor {
  id: string;
  displayName: string;
  baseCity: string | null;
}

export interface CommunityPost {
  id: string;
  category: CommunityCategory;
  title: string;
  body: string;
  likeCount: number;
  dislikeCount: number;
  createdAt: string;
  author: CommunityPostAuthor;
  myReaction: ReactionKind | null;
  isOwn: boolean;
}

export interface CommunityListResponse {
  items: CommunityPost[];
  nextCursor: string | null;
}

export interface CreatePostInput {
  category: CommunityCategory;
  title: string;
  body: string;
}

export interface ListPostsParams {
  cursor?: string;
  limit?: number;
  category?: CommunityCategory;
  sort?: CommunitySort;
  mine?: boolean;
}

export const CommunityApi = {
  list: (params?: ListPostsParams) =>
    api
      .get('/community/posts', { params })
      .then(parseEnvelope(communityListResponseSchema, 'driver.community.posts.list')),
  create: (body: CreatePostInput) =>
    api.post('/community/posts', body, idempotencyConfig())
      .then(parseEnvelope(driverCommunityPostSchema, 'driver.community.posts.create')),
  react: (id: string, kind: ReactionKind) =>
    api.post(`/community/posts/${id}/react`, { kind }, idempotencyConfig())
      .then(parseEnvelope(driverCommunityPostSchema, 'driver.community.posts.react')),
  remove: (id: string) =>
    api.delete(`/community/posts/${id}`, idempotencyConfig())
      .then(parseEnvelope(EmptySuccessDataSchema, 'driver.community.posts.delete')),
};

/* -------- Reviews ------------------------------------------------------- */

export interface PlatformReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: string;
  author: {
    id?: string;
    displayName: string;
    baseCity: string | null;
  };
}

export interface ReviewsSummary {
  count: number;
  averageRating: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface ReviewsListResponse {
  items: PlatformReview[];
  nextCursor: string | null;
}

export interface MyReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertReviewInput {
  rating: number;
  title?: string;
  body: string;
}

export const ReviewsApi = {
  list: (params?: { cursor?: string; limit?: number; rating?: number }) =>
    api.get('/reviews', { params }).then(parseEnvelope(reviewsListResponseSchema, 'driver.reviews.list')),
  summary: () => api.get('/reviews/summary').then(parseEnvelope(reviewsSummarySchema, 'driver.reviews.summary')),
  mine: () => api.get('/reviews/me').then(parseEnvelope(myReviewSchema.nullable(), 'driver.reviews.mine')),
  upsert: (body: UpsertReviewInput) =>
    api.put('/reviews/me', body, idempotencyConfig()).then(parseEnvelope(myReviewSchema, 'driver.reviews.upsert')),
  remove: () =>
    api.delete('/reviews/me', idempotencyConfig())
      .then(parseEnvelope(EmptySuccessDataSchema, 'driver.reviews.delete-mine')),
};

/** Public testimonial endpoints — used on login/register/marketing surfaces (no auth). */
export const PublicReviewsApi = {
  featured: (limit = 6) =>
    publicApi
      .get('/public/reviews/featured', { params: { limit } })
      .then(parseEnvelope(platformReviewSchema.array(), 'public.reviews.featured')),
  summary: () => publicApi.get('/public/reviews/summary')
    .then(parseEnvelope(reviewsSummarySchema, 'public.reviews.summary')),
};

/* -------- Support ------------------------------------------------------- */

export type TicketCategory =
  | 'BUG'
  | 'FEATURE_REQUEST'
  | 'IMPROVEMENT'
  | 'QUESTION'
  | 'OTHER';

export type TicketStatus = 'OPEN' | 'IN_REVIEW' | 'PLANNED' | 'RESOLVED' | 'CLOSED';

export interface SupportTicket {
  id: string;
  category: TicketCategory;
  subject: string;
  body: string;
  status: TicketStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketListResponse {
  items: SupportTicket[];
  nextCursor: string | null;
}

export interface CreateTicketInput {
  category: TicketCategory;
  subject: string;
  body: string;
}

export const SupportApi = {
  list: (params?: { cursor?: string; limit?: number }) =>
    api.get('/support/tickets', { params })
      .then(parseEnvelope(supportTicketListResponseSchema, 'driver.support.tickets.list')),
  get: (id: string) => api.get(`/support/tickets/${id}`)
    .then(parseEnvelope(driverSupportTicketSchema, 'driver.support.tickets.get')),
  create: (body: CreateTicketInput) =>
    api.post('/support/tickets', body, idempotencyConfig())
      .then(parseEnvelope(driverSupportTicketSchema, 'driver.support.tickets.create')),
  close: (id: string) =>
    api.post(`/support/tickets/${id}/close`, {}, idempotencyConfig())
      .then(parseEnvelope(EmptySuccessDataSchema, 'driver.support.tickets.close')),
};
