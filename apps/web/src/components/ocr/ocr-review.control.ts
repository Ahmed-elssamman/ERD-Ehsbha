import type { OcrParsedTripDto, OcrPaymentMethod } from '@/lib/api/ocr.api';
import { TripIncomeMode } from '@ehsbha/shared-types';

export const OCR_INCOME_OPTIONS = [
  { value: TripIncomeMode.Breakdown, labelKey: 'trips.finance.breakdown' },
  { value: TripIncomeMode.TakeHome, labelKey: 'trips.finance.takeHome' },
];

export enum OcrFieldKind { Money = 'money', Distance = 'distance', Duration = 'duration', DateTime = 'datetime', Text = 'text' }
export interface OcrFieldControl { field: keyof OcrParsedTripDto; labelKey: string; kind: OcrFieldKind; incomeMode?: TripIncomeMode }

export const OCR_REVIEW_FIELDS: OcrFieldControl[] = [
  { field: 'earningsEgp', labelKey: 'trips.finance.earnings', kind: OcrFieldKind.Money, incomeMode: TripIncomeMode.TakeHome },
  { field: 'grossEgp', labelKey: 'trips.field.gross', kind: OcrFieldKind.Money, incomeMode: TripIncomeMode.Breakdown },
  { field: 'commissionEgp', labelKey: 'trips.field.commission', kind: OcrFieldKind.Money, incomeMode: TripIncomeMode.Breakdown },
  { field: 'receivedEgp', labelKey: 'trips.field.received', kind: OcrFieldKind.Money, incomeMode: TripIncomeMode.Breakdown },
  { field: 'tipEgp', labelKey: 'trips.ocr.fieldTip', kind: OcrFieldKind.Money },
  { field: 'tollEgp', labelKey: 'trips.field.toll', kind: OcrFieldKind.Money },
  { field: 'parkingEgp', labelKey: 'trips.field.parking', kind: OcrFieldKind.Money },
  { field: 'waitingFeeEgp', labelKey: 'trips.ocr.waitingFee', kind: OcrFieldKind.Money },
  { field: 'totalKm', labelKey: 'trips.field.totalKm', kind: OcrFieldKind.Distance },
  { field: 'paidKm', labelKey: 'trips.ocr.fieldPaidKm', kind: OcrFieldKind.Distance },
  { field: 'startedAt', labelKey: 'trips.field.startedAt', kind: OcrFieldKind.DateTime },
  { field: 'endedAt', labelKey: 'trips.ocr.fieldEndedAt', kind: OcrFieldKind.DateTime },
  { field: 'durationSec', labelKey: 'trips.ocr.durationSeconds', kind: OcrFieldKind.Duration },
  { field: 'pickup', labelKey: 'trips.ocr.fieldPickup', kind: OcrFieldKind.Text },
  { field: 'destination', labelKey: 'trips.ocr.fieldDestination', kind: OcrFieldKind.Text },
  { field: 'notes', labelKey: 'trips.field.notes', kind: OcrFieldKind.Text },
];

export interface OcrPaymentControl { value: OcrPaymentMethod; labelKey: string }
export const OCR_PAYMENT_OPTIONS: OcrPaymentControl[] = [
  { value: 'unknown', labelKey: 'trips.ocr.paymentUnknown' },
  { value: 'cash', labelKey: 'trips.ocr.paymentCash' },
  { value: 'card', labelKey: 'trips.ocr.paymentCard' },
  { value: 'wallet', labelKey: 'trips.ocr.paymentWallet' },
];
