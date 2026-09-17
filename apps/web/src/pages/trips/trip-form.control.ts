import { z } from 'zod';
import { resolveTripFinancials, TripIncomeMode, resolveLocalDateTime, LocalTimeOccurrence } from '@ehsbha/shared-types';
import { MAX_RECORDED_WORK_INTERVAL_MS } from '@ehsbha/api-contracts';

export const TRIP_INCOME_OPTIONS = [
  { value: TripIncomeMode.Breakdown, labelKey: 'trips.finance.breakdown' },
  { value: TripIncomeMode.TakeHome, labelKey: 'trips.finance.takeHome' },
];

const optionalAmount = z.union([z.string(), z.number()]).transform((value) =>
  typeof value === 'string' && !value.trim() ? null : Number(value)).pipe(z.number().finite().min(0).nullable());
const nonnegativeNumber = z.union([z.string(), z.number()]).pipe(z.coerce.number().finite().min(0));

export const tripFormSchema = z.object({
  incomeMode: z.nativeEnum(TripIncomeMode),
  vehicleId: z.string().min(1), driverAppId: z.string().min(1), areaId: z.string().nullable().optional(),
  startedAt: z.string().min(1), endedAt: z.string().min(1),
  startedOccurrence: z.nativeEnum(LocalTimeOccurrence).default(LocalTimeOccurrence.Unspecified),
  endedOccurrence: z.nativeEnum(LocalTimeOccurrence).default(LocalTimeOccurrence.Unspecified),
  recordedStartedAt: z.string().nullable().default(null), recordedEndedAt: z.string().nullable().default(null),
  grossEgp: optionalAmount, receivedEgp: optionalAmount, commissionEgp: optionalAmount, earningsEgp: optionalAmount,
  tipEgp: nonnegativeNumber, commissionAuto: z.boolean(),
  tollEgp: nonnegativeNumber, parkingEgp: nonnegativeNumber,
  totalKm: nonnegativeNumber, paidKm: nonnegativeNumber, notes: z.string().max(500).nullable().optional(),
}).superRefine((value, context) => {
  const start = resolveLocalDateTime(value.startedAt, value.startedOccurrence, value.recordedStartedAt);
  const end = resolveLocalDateTime(value.endedAt, value.endedOccurrence, value.recordedEndedAt);
  if (!start) context.addIssue({ code: 'custom', path: ['startedAt'], message: 'time-invalid' });
  if (!end) context.addIssue({ code: 'custom', path: ['endedAt'], message: 'time-invalid' });
  if (start && end) {
    const duration = new Date(end).getTime() - new Date(start).getTime();
    if (duration <= 0) context.addIssue({ code: 'custom', path: ['endedAt'], message: 'end-before-start' });
    if (duration > MAX_RECORDED_WORK_INTERVAL_MS) context.addIssue({ code: 'custom', path: ['endedAt'], message: 'interval-too-long' });
  }
  if (value.paidKm > value.totalKm) context.addIssue({ code: 'custom', path: ['paidKm'], message: 'paid-exceeds-total' });
  const takeHome = value.incomeMode === TripIncomeMode.TakeHome;
  const money = (amount: number | null): number | null => amount === null ? null : Math.round(amount * 100);
  if (!resolveTripFinancials({ grossPiastres: takeHome ? null : money(value.grossEgp),
    commissionPiastres: takeHome ? null : money(value.commissionEgp), receivedPiastres: takeHome ? null : money(value.receivedEgp),
    earningsPiastres: takeHome ? money(value.earningsEgp) : null, tipPiastres: Math.round(value.tipEgp * 100) })) {
    context.addIssue({ code: 'custom', path: [takeHome ? 'earningsEgp' : 'grossEgp'], message: 'financial-evidence-invalid' });
  }
});

export type TripFormInput = z.input<typeof tripFormSchema>;
