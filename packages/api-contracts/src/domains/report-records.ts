import { z } from 'zod';
import { isCalendarDate, ReportPeriod, ReportCostKind, ReportSnapshotVersion, NotificationKind } from '@ehsbha/shared-types';
import { registerOperation } from '../catalog/registry';
import type { PaginationDescriptor } from '../catalog/types';

const date = z.string().refine(isCalendarDate, 'Expected YYYY-MM-DD');
const integer = z.number().int().safe();
const count = integer.nonnegative();
const money = integer;
const minute = z.number().int().min(0).max(1439);
const cursor = z.string().min(1).max(2048).optional();
const limit = z.coerce.number().int().min(1).max(100).default(25);

export interface ReportTotals {
  tripCount: number; recordedDays: number; grossKnownTripCount: number; commissionKnownTripCount: number;
  grossPiastres: number | null; knownGrossPiastres: number; commissionPiastres: number | null; knownCommissionPiastres: number;
  takeHomePiastres: number; netPiastres: number; totalCostsPiastres: number; fuelCashPiastres: number; maintenanceCashPiastres: number; expenseCashPiastres: number;
  totalKmMeters: number; paidKmMeters: number; emptyKmMeters: number; workMinutes: number; netPerHourPiastres: number | null; netPerKmPiastres: number | null;
}
export const reportTotalsSchema = z.object({
  tripCount: count, recordedDays: count, grossKnownTripCount: count, commissionKnownTripCount: count,
  grossPiastres: money.nullable(), knownGrossPiastres: money, commissionPiastres: money.nullable(), knownCommissionPiastres: money,
  takeHomePiastres: money, netPiastres: money, totalCostsPiastres: money, fuelCashPiastres: money, maintenanceCashPiastres: money, expenseCashPiastres: money,
  totalKmMeters: count, paidKmMeters: count, emptyKmMeters: count, workMinutes: count, netPerHourPiastres: money.nullable(), netPerKmPiastres: money.nullable(),
}).strict();
export interface ReportDay { date: string; recorded: boolean; totals: ReportTotals }
export interface ReportComparison { startsOn: string; endsOn: string; totals: ReportTotals }
export interface ReportPlatform {
  id: string; name: string; tripCount: number; totalKmMeters: number; workMinutes: number;
  contributionPiastres: number; contributionPerKmPiastres: number | null; grossPiastres: number | null; knownGrossPiastres: number; grossKnownTripCount: number;
}
export const reportPlatformSchema = z.object({ id: z.string(), name: z.string(), tripCount: count, totalKmMeters: count, workMinutes: count,
  contributionPiastres: money, contributionPerKmPiastres: money.nullable(), grossPiastres: money.nullable(), knownGrossPiastres: money, grossKnownTripCount: count }).strict();
export interface ReportVehicleCost { id: string; name: string; fuelPiastres: number; maintenancePiastres: number; expensesPiastres: number; tripFeesPiastres: number; totalPiastres: number; recordCount: number }
export const reportVehicleCostSchema = z.object({ id: z.string(), name: z.string(), fuelPiastres: money, maintenancePiastres: money, expensesPiastres: money, tripFeesPiastres: money, totalPiastres: money, recordCount: count }).strict();
export interface ReportCost { id: string; kind: ReportCostKind; date: string; amountPiastres: number; category: string | null; vehicleId: string | null }
export const reportCostSchema = z.object({ id: z.string(), kind: z.nativeEnum(ReportCostKind), date, amountPiastres: money, category: z.string().nullable(), vehicleId: z.string().nullable() }).strict();
export interface ReportContent {
  schemaVersion: ReportSnapshotVersion.Current; period: ReportPeriod; startsOn: string; endsOn: string;
  totals: ReportTotals; previous: ReportComparison; days: ReportDay[]; platforms: ReportPlatform[] | null; vehicleCosts: ReportVehicleCost[] | null;
  unassignedCostsPiastres: number; largestCosts: ReportCost[]; fuelPurchasesPiastres: number; fuelPurchaseCount: number; maintenanceServicesPiastres: number; maintenanceServiceCount: number;
}
export const reportContentSchema = z.object({
  schemaVersion: z.literal(ReportSnapshotVersion.Current), period: z.nativeEnum(ReportPeriod), startsOn: date, endsOn: date,
  totals: reportTotalsSchema, previous: z.object({ startsOn: date, endsOn: date, totals: reportTotalsSchema }).strict(),
  days: z.array(z.object({ date, recorded: z.boolean(), totals: reportTotalsSchema }).strict()).max(31),
  platforms: z.array(reportPlatformSchema).max(200).nullable(), vehicleCosts: z.array(reportVehicleCostSchema).max(200).nullable(),
  unassignedCostsPiastres: money, largestCosts: z.array(reportCostSchema).max(10), fuelPurchasesPiastres: money, fuelPurchaseCount: count,
  maintenanceServicesPiastres: money, maintenanceServiceCount: count,
}).strict();
export interface ReportSummary { id: string; period: ReportPeriod; startsOn: string; endsOn: string; version: number; capturedAt: string; createdAt: string }
export interface ReportRecord extends ReportSummary { content: ReportContent }
export const reportSummarySchema = z.object({ id: z.string(), period: z.nativeEnum(ReportPeriod), startsOn: date, endsOn: date, version: count.min(1), capturedAt: z.string().datetime(), createdAt: z.string().datetime() }).passthrough();
export const reportRecordSchema = reportSummarySchema.extend({ content: reportContentSchema });
export const reportPageSchema = z.object({ items: reportSummarySchema.array(), nextCursor: z.string().nullable() }).passthrough();
export interface ReportListQuery { period?: ReportPeriod; cursor?: string; limit: number }
export interface ReportHistoryQuery { cursor?: string; limit: number }
export const ReportListQuerySchema = z.object({ period: z.nativeEnum(ReportPeriod).optional(), cursor, limit }).strict();
export const ReportHistoryQuerySchema = z.object({ cursor, limit }).strict();
export interface CreateReport { period: ReportPeriod; date: string; clientMutationId: string }
export interface ReviseReport { expectedVersion: number; clientMutationId: string }
export const CreateReportSchema = z.object({ period: z.nativeEnum(ReportPeriod), date, clientMutationId: z.string().uuid() }).strict();
export const ReviseReportSchema = z.object({ expectedVersion: count.min(1), clientMutationId: z.string().uuid() }).strict();
export const ReportVersionSchema = z.object({ version: z.coerce.number().int().positive().max(2_147_483_647) }).strict();
export interface ReportReadyData { kind: NotificationKind.ReportReady; reportId: string; version: number; period: ReportPeriod; startsOn: string; endsOn: string }
export const reportReadyDataSchema = z.object({ kind: z.literal(NotificationKind.ReportReady), reportId: z.string().min(1), version: count.min(1), period: z.nativeEnum(ReportPeriod), startsOn: date, endsOn: date }).strict();

export interface ReportPreferenceFields { weeklyEnabled: boolean; monthlyEnabled: boolean; deliveryMinute: number; quietEnabled: boolean; quietStartMinute: number; quietEndMinute: number }
export interface ReportPreferences extends ReportPreferenceFields { version: number }
export interface UpdateReportPreferences extends ReportPreferenceFields { expectedVersion: number; clientMutationId: string }
export const reportPreferenceFields = { weeklyEnabled: z.boolean(), monthlyEnabled: z.boolean(), deliveryMinute: minute, quietEnabled: z.boolean(), quietStartMinute: minute, quietEndMinute: minute };
export function validReportSchedule(value: ReportPreferenceFields): boolean {
  if (!value.quietEnabled || (!value.weeklyEnabled && !value.monthlyEnabled)) return true;
  const { deliveryMinute: delivery, quietStartMinute: start, quietEndMinute: end } = value;
  return start < end ? delivery < start || delivery >= end : start > end && delivery < start && delivery >= end;
}
export const reportPreferencesSchema = z.object({ ...reportPreferenceFields, version: count }).passthrough();
export const UpdateReportPreferencesSchema = z.object({ ...reportPreferenceFields, expectedVersion: count, clientMutationId: z.string().uuid() }).strict()
  .refine(validReportSchedule, { path: ['deliveryMinute'], message: 'Choose delivery outside quiet hours' });

const consumers = [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }] as const;
const pagination: PaginationDescriptor = { mode: 'cursor', defaultSize: 25, maximumSize: 100, stableSort: ['createdAt:desc', 'id:desc'], exceptionOwner: null, exceptionReason: null };
registerOperation({ operationId: 'driver.reports.list', transport: 'http', method: 'GET', path: '/api/v1/reports', realm: 'driver', lifecycle: 'active', request: { query: 'ReportListQuerySchema' }, successData: 'reportPageSchema', failureCodes: ['UNAUTHENTICATED', 'VALIDATION_ERROR', 'INVALID_CURSOR'], consumers: [...consumers], compatibility: 'additive-compatible', owner: 'platform', pagination, idempotency: null, followUp: null });
registerOperation({ operationId: 'driver.reports.create', transport: 'http', method: 'POST', path: '/api/v1/reports', realm: 'driver', lifecycle: 'active', request: { body: 'CreateReportSchema' }, successData: 'reportRecordSchema', failureCodes: ['UNAUTHENTICATED', 'VALIDATION_ERROR', 'REPORT_PERIOD_NOT_COMPLETE', 'IDEMPOTENCY_KEY_REUSED'], consumers: [...consumers], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: null, followUp: null });
registerOperation({ operationId: 'driver.reports.get', transport: 'http', method: 'GET', path: '/api/v1/reports/:id', realm: 'driver', lifecycle: 'active', request: {}, successData: 'reportRecordSchema', failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND'], consumers: [...consumers], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: null, followUp: null });
registerOperation({ operationId: 'driver.reports.revise', transport: 'http', method: 'POST', path: '/api/v1/reports/:id/revisions', realm: 'driver', lifecycle: 'active', request: { body: 'ReviseReportSchema' }, successData: 'reportRecordSchema', failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND', 'VALIDATION_ERROR', 'REPORT_VERSION_CONFLICT', 'IDEMPOTENCY_KEY_REUSED'], consumers: [...consumers], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: null, followUp: null });
registerOperation({ operationId: 'driver.reports.history', transport: 'http', method: 'GET', path: '/api/v1/reports/:id/revisions', realm: 'driver', lifecycle: 'active', request: { query: 'ReportHistoryQuerySchema' }, successData: 'reportPageSchema', failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND', 'VALIDATION_ERROR', 'INVALID_CURSOR'], consumers: [...consumers], compatibility: 'additive-compatible', owner: 'platform', pagination: { ...pagination, stableSort: ['version:desc'] }, idempotency: null, followUp: null });
registerOperation({ operationId: 'driver.reports.revision', transport: 'http', method: 'GET', path: '/api/v1/reports/:id/revisions/:version', realm: 'driver', lifecycle: 'active', request: {}, successData: 'reportRecordSchema', failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND', 'VALIDATION_ERROR'], consumers: [...consumers], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: null, followUp: null });
registerOperation({ operationId: 'driver.reports.preferences.get', transport: 'http', method: 'GET', path: '/api/v1/reports/preferences', realm: 'driver', lifecycle: 'active', request: {}, successData: 'reportPreferencesSchema', failureCodes: ['UNAUTHENTICATED'], consumers: [...consumers], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: null, followUp: null });
registerOperation({ operationId: 'driver.reports.preferences.update', transport: 'http', method: 'PATCH', path: '/api/v1/reports/preferences', realm: 'driver', lifecycle: 'active', request: { body: 'UpdateReportPreferencesSchema' }, successData: 'reportPreferencesSchema', failureCodes: ['UNAUTHENTICATED', 'VALIDATION_ERROR', 'REPORT_PREFERENCES_CONFLICT', 'IDEMPOTENCY_KEY_REUSED'], consumers: [...consumers], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: null, followUp: null });
