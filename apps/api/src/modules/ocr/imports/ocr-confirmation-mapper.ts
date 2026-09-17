import { createHash } from 'node:crypto';
import type { OcrTripConfirmation, Prisma } from '@prisma/client';
import { TripPaymentMethod, type OcrConfirmationReceipt, type OcrTripResult } from '@ehsbha/api-contracts';
import type { CreateTripDto } from '../../trips/dto/trips.dto';

interface ConfirmationState extends OcrTripConfirmation { trip?: { deletedAt: Date | null } | null }

export function confirmationReceipt(record: ConfirmationState): OcrConfirmationReceipt {
  return { candidateId: record.candidateId, tripId: record.originalTripId, savedAt: record.createdAt.toISOString(), deleted: record.tripId === null || record.trip?.deletedAt != null };
}

export function confirmationSnapshot(trip: CreateTripDto): Prisma.InputJsonObject {
  return {
    vehicleId: trip.vehicleId, driverAppId: trip.driverAppId, areaId: trip.areaId ?? null,
    startedAt: trip.startedAt.toISOString(), endedAt: trip.endedAt.toISOString(),
    grossPiastres: trip.grossPiastres, receivedPiastres: trip.receivedPiastres ?? null,
    ...(trip.earningsPiastres == null ? {} : { earningsPiastres: trip.earningsPiastres }),
    commissionPiastres: trip.commissionPiastres, tipPiastres: trip.tipPiastres,
    tollPiastres: trip.tollPiastres, parkingPiastres: trip.parkingPiastres,
    totalKmMeters: trip.totalKmMeters, paidKmMeters: trip.paidKmMeters,
    notes: trip.notes ?? null, pickup: trip.pickup ?? null, destination: trip.destination ?? null,
    paymentMethod: trip.paymentMethod ?? TripPaymentMethod.Unknown, waitingFeePiastres: trip.waitingFeePiastres ?? null,
  };
}

export function confirmationHash(snapshot: Prisma.InputJsonObject): string {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

export function originalSnapshot(candidate: OcrTripResult): Prisma.InputJsonObject {
  return {
    parsed: { ...candidate.parsed }, fieldConfidences: { ...candidate.fieldConfidences },
    platform: candidate.evidence?.platform ?? null, platformConfidence: candidate.evidence?.platformConfidence ?? 0,
    sources: candidate.evidence?.sources.map((source) => ({ ...source })) ?? [],
    warnings: candidate.evidence?.warnings ?? [], duplicateOf: candidate.evidence?.duplicateOf ?? null,
  };
}

export function correctedFields(candidate: OcrTripResult, confirmed: Prisma.InputJsonObject): string[] {
  const parsed = candidate.parsed;
  const money = (value: number | null) => value === null ? null : Math.round(value * 100);
  const distance = (value: number | null) => value === null ? null : Math.round(value * 1000);
  const original: Prisma.InputJsonObject = {
    startedAt: parsed.startedAt, endedAt: parsed.endedAt, grossPiastres: money(parsed.grossEgp),
    earningsPiastres: money(parsed.earningsEgp ?? null),
    receivedPiastres: money(parsed.receivedEgp), commissionPiastres: money(parsed.commissionEgp),
    tipPiastres: money(parsed.tipEgp), tollPiastres: money(parsed.tollEgp), parkingPiastres: money(parsed.parkingEgp),
    totalKmMeters: distance(parsed.totalKm), paidKmMeters: distance(parsed.paidKm),
    pickup: parsed.pickup, destination: parsed.destination, paymentMethod: parsed.paymentMethod,
    waitingFeePiastres: money(parsed.waitingFeeEgp), notes: parsed.notes,
  };
  return Object.keys(original).filter((field) => (original[field] ?? null) !== (confirmed[field] ?? null));
}
