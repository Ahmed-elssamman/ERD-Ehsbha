import { z } from 'zod';
import { CreateTripSchema, tripItemSchema } from '@ehsbha/api-contracts';
import { LocalTimeOccurrence, TripIncomeMode, tripEarningsPiastres } from '@ehsbha/shared-types';
import { isAxiosError } from 'axios';
import { readApiError } from '@/lib/api/client';
import { toDatetimeLocalValue } from '@/lib/time';
import type { TripItem } from '@/lib/api/endpoints';
import type { TripFormInput } from './trip-form.control';
import { parseDraftJson, RecordDraftError, RecordDraftIssue, type RecordDraft } from '@/lib/record-drafts/record-draft.model';

const rawNumber = z.union([z.string().max(100), z.number().finite()]);
export const TRIP_QUERY_KEYS = ['trips', 'analytics', 'decisions', 'score', 'trip', 'trip-history', 'record-drafts'];
export const tripDraftContextSchema = z.object({ trip: tripItemSchema.nullable() }).strict();
export const tripDraftFieldsSchema = z.object({
  incomeMode: z.nativeEnum(TripIncomeMode), vehicleId: z.string(), driverAppId: z.string(), areaId: z.string().nullable().optional(),
  startedAt: z.string().max(100), endedAt: z.string().max(100),
  startedOccurrence: z.nativeEnum(LocalTimeOccurrence), endedOccurrence: z.nativeEnum(LocalTimeOccurrence),
  recordedStartedAt: z.string().nullable(), recordedEndedAt: z.string().nullable(),
  grossEgp: rawNumber, receivedEgp: rawNumber, commissionEgp: rawNumber, earningsEgp: rawNumber,
  tipEgp: rawNumber, commissionAuto: z.boolean(), tollEgp: rawNumber, parkingEgp: rawNumber,
  totalKm: rawNumber, paidKm: rawNumber, notes: z.string().max(500).nullable().optional(),
}).strict();
export const tripDraftBodySchema = CreateTripSchema.innerType().omit({ clientMutationId: true, pickup: true, destination: true, paymentMethod: true, waitingFeePiastres: true })
  .extend({ startedAt: z.string().datetime({ offset: true }), endedAt: z.string().datetime({ offset: true }) })
  .superRefine((body, context) => {
    if (!CreateTripSchema.safeParse(body).success) context.addIssue({ code: 'custom', message: 'Invalid trip facts' });
  });
export function validateTripDraft(draft: RecordDraft) {
  const { trip } = parseDraftJson(draft.context, tripDraftContextSchema);
  if (draft.scope !== (trip?.id ?? 'new')) throw new RecordDraftError(RecordDraftIssue.Invalid);
  if (draft.fields !== null) parseDraftJson(draft.fields, tripDraftFieldsSchema);
  if (draft.pending && !CreateTripSchema.safeParse(parseDraftJson(draft.pending.body, tripDraftBodySchema)).success) throw new RecordDraftError(RecordDraftIssue.Invalid);
}
export function tripSaveUnconfirmed(error: Error): boolean {
  return readApiError(error).code === 'IDEMPOTENCY_IN_PROGRESS' || !isAxiosError(error) || !error.response || error.response.status >= 500;
}
export function tripErrorKey(error: Error): string {
  const code = readApiError(error).code;
  return ['TRIP_VERSION_CONFLICT', 'EXPENSE_LINK_CONFLICT', 'DAILY_DISTANCE_CONFLICT', 'NOT_FOUND', 'VALIDATION_ERROR'].includes(code) ? 'errors.' + code : 'trips.saveFailed';
}
export function tripStatusErrorKey(error: Error): string {
  const key = tripErrorKey(error);
  if (key === 'errors.TRIP_VERSION_CONFLICT') return 'trips.statusChanged';
  return key === 'trips.saveFailed' ? 'trips.statusUnconfirmed' : key;
}
const piastresToEgp = (amount: number | null) => amount === null ? '' : amount / 100;

export function tripDraftDefaults(trip: TripItem | null): TripFormInput {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    if (trip) {
      return {
        incomeMode: trip.grossPiastres == null ? TripIncomeMode.TakeHome : TripIncomeMode.Breakdown,
        earningsEgp: tripEarningsPiastres(trip) / 100,
        vehicleId: trip.vehicleId,
        driverAppId: trip.driverAppId,
        areaId: trip.areaId ?? '',
        startedAt: toDatetimeLocalValue(new Date(trip.startedAt)),
        endedAt: toDatetimeLocalValue(new Date(trip.endedAt)),
        startedOccurrence: LocalTimeOccurrence.Unspecified, endedOccurrence: LocalTimeOccurrence.Unspecified,
        recordedStartedAt: trip.startedAt, recordedEndedAt: trip.endedAt,
        grossEgp: piastresToEgp(trip.grossPiastres),
        receivedEgp: piastresToEgp(trip.receivedPiastres ?? null),
        tipEgp: trip.tipPiastres / 100,
        commissionEgp: piastresToEgp(trip.commissionPiastres),
        commissionAuto: false,
        tollEgp: (trip.tollPiastres ?? 0) / 100,
        parkingEgp: (trip.parkingPiastres ?? 0) / 100,
        totalKm: trip.totalKmMeters / 1000,
        paidKm: trip.paidKmMeters / 1000,
        notes: trip.notes ?? '',
      };
    }
    const base: TripFormInput = {
      incomeMode: TripIncomeMode.Breakdown, earningsEgp: '',
      vehicleId: '',
      driverAppId: '',
      areaId: '',
      startedAt: toDatetimeLocalValue(oneHourAgo),
      endedAt: toDatetimeLocalValue(now),
      startedOccurrence: LocalTimeOccurrence.Unspecified, endedOccurrence: LocalTimeOccurrence.Unspecified,
      recordedStartedAt: null, recordedEndedAt: null,
      grossEgp: '',
      receivedEgp: '',
      tipEgp: 0,
      commissionEgp: '',
      commissionAuto: true,
      tollEgp: 0,
      parkingEgp: 0,
      totalKm: 0,
      paidKm: 0,
      notes: '',
    };
    return base;
}
