import axios from 'axios';
import { api, apiBaseUrl, unwrap } from './client';

/** A vanilla axios instance for endpoints that should not send Authorization. */
const publicApi = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
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
  }) => api.post('/auth/register', body).then((r) => unwrap<AuthResult>(r.data)),
  login: (body: { phone: string; password: string; deviceId?: string }) =>
    api.post('/auth/login', body).then((r) => unwrap<AuthResult>(r.data)),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }).then((r) => unwrap<AuthResult>(r.data)),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  lookupResetEmail: (body: { phone: string }) =>
    api.post('/auth/password/lookup', body).then((r) => unwrap<LookupEmailResult>(r.data)),
  forgotPassword: (body: { phone: string }) =>
    api.post('/auth/password/forgot', body).then((r) => unwrap<ForgotResult>(r.data)),
  resetPassword: (body: { phone: string; code: string; newPassword: string }) =>
    api.post('/auth/password/reset', body).then((r) => unwrap<{ ok: boolean }>(r.data)),
  updateMe: (body: { email?: string | null; locale?: 'ar' | 'en'; timezone?: string }) =>
    api.patch('/me', body).then((r) => unwrap<AuthUser>(r.data)),
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
  me: () => api.get('/drivers/me').then((r) => unwrap<DriverMe>(r.data)),
  update: (body: Partial<{ displayName: string; photoUrl: string | null; baseCity: string | null }>) =>
    api.patch('/drivers/me', body).then((r) => unwrap<DriverMe>(r.data)),
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
  list: () => api.get('/vehicles').then((r) => unwrap<Vehicle[]>(r.data)),
  get: (id: string) => api.get(`/vehicles/${id}`).then((r) => unwrap<Vehicle>(r.data)),
  create: (body: Partial<Vehicle> & { type: VehicleType; fuelType: FuelType }) =>
    api.post('/vehicles', body).then((r) => unwrap<Vehicle>(r.data)),
  update: (id: string, body: Partial<Vehicle>) =>
    api.patch(`/vehicles/${id}`, body).then((r) => unwrap<Vehicle>(r.data)),
  updateCosts: (id: string, body: Partial<Vehicle>) =>
    api.patch(`/vehicles/${id}/costs`, body).then((r) => unwrap<Vehicle>(r.data)),
  costSummary: (id: string) =>
    api.get(`/vehicles/${id}/cost-summary`).then((r) => unwrap<VehicleCostSummary>(r.data)),
  remove: (id: string) => api.delete(`/vehicles/${id}`),
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
    api.get('/apps').then((r) => unwrap<AppSource[]>(r.data).map(coerceAppSource)),
  mine: () =>
    api.get('/drivers/me/apps').then((r) => unwrap<DriverApp[]>(r.data).map(coerceDriverApp)),
  add: (body: Partial<DriverApp> & ({ appSourceId: string } | { customName: string })) =>
    api.post('/drivers/me/apps', body).then((r) => coerceDriverApp(unwrap<DriverApp>(r.data))),
  update: (id: string, body: Partial<DriverApp>) =>
    api.patch(`/drivers/me/apps/${id}`, body).then((r) => coerceDriverApp(unwrap<DriverApp>(r.data))),
  remove: (id: string) => api.delete(`/drivers/me/apps/${id}`),
};

/* -------- Areas --------------------------------------------------------- */

export interface Area {
  id: string;
  name: string;
  color: string | null;
}

export const AreasApi = {
  list: () => api.get('/areas').then((r) => unwrap<Area[]>(r.data)),
  create: (body: { name: string; color?: string }) =>
    api.post('/areas', body).then((r) => unwrap<Area>(r.data)),
  update: (id: string, body: Partial<{ name: string; color: string }>) =>
    api.patch(`/areas/${id}`, body).then((r) => unwrap<Area>(r.data)),
  remove: (id: string) => api.delete(`/areas/${id}`),
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
  }) => api.get('/trips', { params }).then((r) => unwrap<TripsListResponse>(r.data)),
  get: (id: string) => api.get(`/trips/${id}`).then((r) => unwrap<TripItem>(r.data)),
  create: (body: CreateTripInput) => api.post('/trips', body).then((r) => unwrap<TripItem>(r.data)),
  /** Bulk-create endpoint backing the OCR multi-trip flow. One request, N
   * trips; the server returns successes and per-index failures separately. */
  createBatch: (items: CreateTripInput[]) =>
    api.post('/trips/batch', { items }).then((r) => unwrap<BatchCreateTripsResponse>(r.data)),
  update: (id: string, body: Partial<CreateTripInput>) =>
    api.patch(`/trips/${id}`, body).then((r) => unwrap<TripItem>(r.data)),
  remove: (id: string) => api.delete(`/trips/${id}`),
  /** Bulk-delete used by the trip list's multi-select toolbar. */
  removeBatch: (ids: string[]) =>
    api.post('/trips/batch-delete', { ids }).then((r) => unwrap<BatchDeleteTripsResponse>(r.data)),
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
    api.get('/expenses', { params }).then((r) => unwrap<Expense[]>(r.data)),
  create: (body: CreateExpenseInput) =>
    api.post('/expenses', body).then((r) => unwrap<Expense>(r.data)),
  update: (id: string, body: Partial<CreateExpenseInput>) =>
    api.patch(`/expenses/${id}`, body).then((r) => unwrap<Expense>(r.data)),
  remove: (id: string) => api.delete(`/expenses/${id}`),
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
    api.get('/fuel', { params }).then((r) => unwrap<FuelEntry[]>(r.data)),
  create: (body: Partial<FuelEntry>) => api.post('/fuel', body).then((r) => unwrap<FuelEntry>(r.data)),
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
  items: () => api.get('/maintenance/items').then((r) => unwrap<MaintenanceItem[]>(r.data)),
  records: (vehicleId: string) =>
    api.get(`/vehicles/${vehicleId}/maintenance/records`).then((r) => unwrap<MaintenanceRecord[]>(r.data)),
  addRecord: (vehicleId: string, body: { maintenanceItemId: string; performedAt: string; odometerMeters: number; costPiastres: number; notes?: string | null }) =>
    api.post(`/vehicles/${vehicleId}/maintenance/records`, body).then((r) => unwrap<MaintenanceRecord>(r.data)),
  risk: (vehicleId: string) =>
    api.get(`/vehicles/${vehicleId}/maintenance/risk`).then((r) => unwrap<MaintenanceRiskRow[]>(r.data)),
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
  list: () => api.get('/goals').then((r) => unwrap<Goal[]>(r.data)),
  create: (body: { period: GoalPeriod; targetPiastres: number; startsOn: string; endsOn: string }) =>
    api.post('/goals', body).then((r) => unwrap<Goal>(r.data)),
  update: (id: string, body: Partial<Goal>) =>
    api.patch(`/goals/${id}`, body).then((r) => unwrap<Goal>(r.data)),
  remove: (id: string) => api.delete(`/goals/${id}`),
  progress: (id: string) => api.get(`/goals/${id}/progress`).then((r) => unwrap<GoalProgress>(r.data)),
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
  today: () => api.get('/analytics/today').then((r) => unwrap<DailyAnalytics>(r.data)),
  daily: (date?: string) =>
    api.get('/analytics/daily', { params: date ? { date } : undefined }).then((r) => unwrap<DailyAnalytics>(r.data)),
  weekly: (isoYear: number, isoWeek: number) =>
    api.get('/analytics/weekly', { params: { isoYear, isoWeek } }).then((r) => unwrap<WeeklyAnalytics>(r.data)),
  monthly: (year: number, month: number) =>
    api.get('/analytics/monthly', { params: { year, month } }).then((r) => unwrap<MonthlyAnalytics>(r.data)),
  apps: (window = '7d') =>
    api.get('/analytics/apps', { params: { window } }).then((r) => unwrap<{ windowDays: number; items: AppPerformanceRow[] }>(r.data)),
  areas: (window = '7d') =>
    api.get('/analytics/areas', { params: { window } }).then((r) => unwrap<{ windowDays: number; items: AreaPerformanceRow[] }>(r.data)),
  hours: (window = '7d') =>
    api.get('/analytics/hours', { params: { window } }).then((r) => unwrap<{ windowDays: number; items: HourBucketRow[] }>(r.data)),
  forecastMonthly: () =>
    api.get('/analytics/forecast/monthly').then((r) => unwrap<MonthlyForecast>(r.data)),
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
    api.get('/recommendations', { params: { surface } }).then((r) => unwrap<DecisionCard[]>(r.data)),
  dismiss: (id: string) => api.post(`/recommendations/${id}/dismiss`),
  todaysDecisions: () => api.get('/decisions/today').then((r) => unwrap<DecisionCard[]>(r.data)),
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
  today: () => api.get('/score/today').then((r) => unwrap<DriverScore | null>(r.data)),
  history: (params?: { from?: string; to?: string }) =>
    api.get('/score/history', { params }).then((r) => unwrap<DriverScore[]>(r.data)),
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

export interface DailyDigestData {
  kind: 'DAILY_DIGEST';
  locale: 'ar' | 'en';
  insights: {
    todayTargetPiastres: number | null;
    monthlyGoalPiastres: number | null;
    earnedThisMonthPiastres: number;
    remainingDaysInMonth: number;
    bestHour: { hour: number; netEgpPerHr: number } | null;
    bestAppForDow: { appId: string; appName: string; netPiastres: number } | null;
    lowEgpPerKmArea: { areaId: string; areaName: string; egpPerKm: number } | null;
    emptyKmRatioYesterday: number | null;
    yesterdayNetPiastres: number;
  };
  tips: Array<{ key: string; vars: Record<string, string | number> }>;
}

export const NotificationsApi = {
  list: (params?: { cursor?: string; limit?: number }) =>
    api.get('/notifications', { params }).then((r) => unwrap<{ items: AppNotification[]; nextCursor: string | null }>(r.data)),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
  /** Dev / onboarding helper: triggers today's digest synchronously and
   * stores it as an in-app notification. Returns the new id. */
  triggerDailyDigest: () =>
    api.post('/notifications/daily-digest/me').then((r) => unwrap<{ notificationId: string }>(r.data)),
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
      .then((r) => unwrap<CommunityListResponse>(r.data)),
  create: (body: CreatePostInput) =>
    api.post('/community/posts', body).then((r) => unwrap<CommunityPost>(r.data)),
  react: (id: string, kind: ReactionKind) =>
    api.post(`/community/posts/${id}/react`, { kind }).then((r) => unwrap<CommunityPost>(r.data)),
  remove: (id: string) => api.delete(`/community/posts/${id}`),
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
    api.get('/reviews', { params }).then((r) => unwrap<ReviewsListResponse>(r.data)),
  summary: () => api.get('/reviews/summary').then((r) => unwrap<ReviewsSummary>(r.data)),
  mine: () => api.get('/reviews/me').then((r) => unwrap<MyReview | null>(r.data)),
  upsert: (body: UpsertReviewInput) =>
    api.put('/reviews/me', body).then((r) => unwrap<MyReview>(r.data)),
  remove: () => api.delete('/reviews/me'),
};

/** Public testimonial endpoints — used on login/register/marketing surfaces (no auth). */
export const PublicReviewsApi = {
  featured: (limit = 6) =>
    publicApi
      .get('/public/reviews/featured', { params: { limit } })
      .then((r) => unwrap<PlatformReview[]>(r.data)),
  summary: () => publicApi.get('/public/reviews/summary').then((r) => unwrap<ReviewsSummary>(r.data)),
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
    api.get('/support/tickets', { params }).then((r) => unwrap<SupportTicketListResponse>(r.data)),
  get: (id: string) => api.get(`/support/tickets/${id}`).then((r) => unwrap<SupportTicket>(r.data)),
  create: (body: CreateTicketInput) =>
    api.post('/support/tickets', body).then((r) => unwrap<SupportTicket>(r.data)),
  close: (id: string) => api.post(`/support/tickets/${id}/close`),
};
