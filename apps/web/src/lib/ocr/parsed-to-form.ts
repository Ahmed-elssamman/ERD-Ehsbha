import type { OcrParsedTripDto } from '@/lib/api/ocr.api';
import { toDatetimeLocalValue } from '@/lib/time';

export interface PrefilledFormValues {
  startedAt?: string;
  endedAt?: string;
  grossEgp?: number;
  receivedEgp?: number;
  tipEgp?: number;
  commissionEgp?: number;
  commissionAuto?: boolean;
  tollEgp?: number;
  parkingEgp?: number;
  totalKm?: number;
  paidKm?: number;
  notes?: string;
}

export function parsedToFormValues(p: OcrParsedTripDto): PrefilledFormValues {
  const out: PrefilledFormValues = {};
  if (p.grossEgp != null) out.grossEgp = p.grossEgp;
  if (p.receivedEgp != null) out.receivedEgp = p.receivedEgp;
  if (p.tipEgp != null) out.tipEgp = p.tipEgp;
  if (p.commissionEgp != null) {
    out.commissionEgp = p.commissionEgp;
    out.commissionAuto = false;
  } else {
    out.commissionAuto = true;
  }
  if (p.tollEgp != null) out.tollEgp = p.tollEgp;
  if (p.parkingEgp != null) out.parkingEgp = p.parkingEgp;
  if (p.totalKm != null) out.totalKm = p.totalKm;
  if (p.paidKm != null) out.paidKm = p.paidKm;
  else if (p.totalKm != null) out.paidKm = p.totalKm;
  if (p.startedAt) {
    const d = new Date(p.startedAt);
    if (!Number.isNaN(d.getTime())) out.startedAt = toDatetimeLocalValue(d);
  }
  if (p.endedAt) {
    const d = new Date(p.endedAt);
    if (!Number.isNaN(d.getTime())) out.endedAt = toDatetimeLocalValue(d);
  } else if (p.startedAt && p.durationSec != null) {
    const end = new Date(new Date(p.startedAt).getTime() + p.durationSec * 1000);
    out.endedAt = toDatetimeLocalValue(end);
  }
  if (p.notes) out.notes = p.notes;
  return out;
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Derives a stable clientMutationId from image hashes (32 hex chars). */
export async function deriveClientMutationId(imageHashes: string[]): Promise<string> {
  const sorted = [...imageHashes].sort().join('|');
  const full = await sha256Hex(sorted);
  return full.slice(0, 32);
}
