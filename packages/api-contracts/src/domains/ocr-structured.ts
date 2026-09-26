import { z } from 'zod'

export enum OcrStructuredPlatform {
  Uber = 'uber',
  Careem = 'careem',
  Indrive = 'indrive',
  Didi = 'didi',
  Other = 'other',
}

export interface OcrFareDetails {
  total_fare: number | null
  net_earnings: number | null
  cash_collected: number | null
  app_commission: number | null
  tip: number | null
  toll_fees: number | null
  discount_or_promo: number | null
  currency: string | null
}

export interface OcrTripMetrics {
  distance_km: number | null
  duration_minutes: number | null
  trip_date: string | null
  trip_time: string | null
}

export interface OcrTripRoute {
  pickup_location: string | null
  dropoff_location: string | null
}

export interface OcrStructuredTrip {
  platform: OcrStructuredPlatform
  trip_id: string | null
  fare_details: OcrFareDetails
  trip_metrics: OcrTripMetrics
  route: OcrTripRoute
  confidence_score: number
}

const amount = z.number().finite().nonnegative().nullable()
const location = z.string().min(1).max(2000).nullable()
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}).nullable()

export const ocrStructuredTripSchema: z.ZodType<OcrStructuredTrip> = z.object({
  platform: z.nativeEnum(OcrStructuredPlatform),
  trip_id: z.string().min(1).max(200).nullable(),
  fare_details: z.object({
    total_fare: amount, net_earnings: amount, cash_collected: amount,
    app_commission: amount, tip: amount, toll_fees: amount,
    discount_or_promo: amount, currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  }).strict(),
  trip_metrics: z.object({
    distance_km: amount, duration_minutes: amount, trip_date: date,
    trip_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable(),
  }).strict(),
  route: z.object({ pickup_location: location, dropoff_location: location }).strict(),
  confidence_score: z.number().finite().min(0).max(1),
}).strict()
