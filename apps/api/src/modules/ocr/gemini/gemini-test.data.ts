import { OcrStructuredPlatform, type OcrStructuredTrip } from '@ehsbha/api-contracts';
import type { GeminiDocument } from './gemini.model';

export const GEMINI_TEST_TRIP: OcrStructuredTrip = {
  platform: OcrStructuredPlatform.Didi, trip_id: 'receipt-123',
  fare_details: {
    total_fare: 24.4, net_earnings: 20.96, cash_collected: 20,
    app_commission: 3.44, tip: null, toll_fees: null, discount_or_promo: 4.4, currency: 'EGP',
  },
  trip_metrics: { distance_km: 2.8, duration_minutes: 9 + 2 / 60, trip_date: '2026-05-16', trip_time: '20:09' },
  route: { pickup_location: 'مدينة نصر', dropoff_location: 'العباسية' },
  confidence_score: 0.92,
};

export const GEMINI_TEST_DOCUMENT: GeminiDocument = {
  raw_text: 'DiDi\nأرباحك 20.96 ج.م.\nأجرة المشوار 24.40\nتم استلام النقد 20.00',
  trips: [GEMINI_TEST_TRIP],
};
