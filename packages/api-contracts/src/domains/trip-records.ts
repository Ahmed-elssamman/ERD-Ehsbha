import { z } from 'zod';
import { TripChange, TripChangeActor, TripRecordSource } from '@ehsbha/shared-types';
import { registerOperation } from '../catalog/registry';
import type { IdempotencyPolicy } from '../catalog/types';
import { TripPaymentMethod, tripRecordIntegerSchema } from './trip-details';

export const tripRecordMetadataShape = { version: z.number().int().positive(), source: z.nativeEnum(TripRecordSource) };
export const TripVersionSchema = z.object({ expectedVersion: z.coerce.number().int().positive() }).strict();
export const tripVersionTargetSchema = z.object({ id: z.string().min(1), expectedVersion: z.number().int().positive() }).strict();
export const tripVersionTargetsSchema = z.array(tripVersionTargetSchema).min(1).max(200)
  .refine((items) => new Set(items.map((item) => item.id)).size === items.length, 'Duplicate trip targets');
export const TripBulkActionSchema = z.object({ items: tripVersionTargetsSchema, reason: z.string().min(3).max(500) }).strict();
export const TripHistoryQuerySchema = z.object({ cursor: z.string().min(1).max(2048).optional(), limit: z.coerce.number().int().min(1).max(100).default(25) }).strict();
const instant = z.string().datetime({ offset: true });
export const tripSnapshotSchema = z.object({
  ...tripRecordMetadataShape, vehicleId: z.string(), driverAppId: z.string(), areaId: z.string().nullable(),
  startedAt: instant, endedAt: instant, grossPiastres: tripRecordIntegerSchema.nullable(),
  earningsPiastres: z.number().int().nonnegative().safe().nullable(), receivedPiastres: tripRecordIntegerSchema.nullable(),
  commissionPiastres: tripRecordIntegerSchema.nullable(), tipPiastres: tripRecordIntegerSchema,
  tollPiastres: tripRecordIntegerSchema, parkingPiastres: tripRecordIntegerSchema,
  totalKmMeters: tripRecordIntegerSchema, paidKmMeters: tripRecordIntegerSchema, emptyKmMeters: tripRecordIntegerSchema,
  waitingFeePiastres: tripRecordIntegerSchema.nullable(), paymentMethod: z.nativeEnum(TripPaymentMethod), deletedAt: instant.nullable(),
}).strict();
export const tripRevisionSchema = z.object({ id: z.string(), recordId: z.string(), version: z.number().int().positive(),
  action: z.nativeEnum(TripChange), actor: z.nativeEnum(TripChangeActor), before: tripSnapshotSchema.nullable(), after: tripSnapshotSchema, createdAt: instant }).passthrough();
export const tripHistorySchema = z.object({ items: z.array(tripRevisionSchema), nextCursor: z.string().nullable() }).passthrough();
export const tripWriteIdempotency: IdempotencyPolicy = { header: 'Idempotency-Key', minimumKeyLength: 8, maximumKeyLength: 128, scope: 'realm-actor-operation-key', retentionHours: 24 };
const producer = [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }] as const;
registerOperation({ operationId: 'driver.trips.history', transport: 'http', method: 'GET', path: '/api/v1/trips/:id/history', realm: 'driver', lifecycle: 'active',
  request: { query: 'TripHistoryQuerySchema' }, successData: 'tripHistorySchema', failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND', 'VALIDATION_ERROR'],
  consumers: [...producer], compatibility: 'additive-compatible', owner: 'platform',
  pagination: { mode: 'cursor', defaultSize: 25, maximumSize: 100, stableSort: ['version:desc'], exceptionOwner: null, exceptionReason: null }, idempotency: null, followUp: null });
registerOperation({ operationId: 'driver.trips.restore', transport: 'http', method: 'POST', path: '/api/v1/trips/:id/restore', realm: 'driver', lifecycle: 'active',
  request: { body: 'TripVersionSchema' }, successData: 'tripItemSchema', failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND', 'VALIDATION_ERROR', 'TRIP_VERSION_CONFLICT', 'EXPENSE_LINK_CONFLICT', 'DAILY_DISTANCE_CONFLICT'],
  consumers: [...producer], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: tripWriteIdempotency, followUp: null });
