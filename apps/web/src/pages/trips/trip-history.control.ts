export const TRIP_HISTORY_DATE_FORMAT: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
export interface TripHistoryLabels { vehicles: Map<string, string>; apps: Map<string, string>; areas: Map<string, string> }
export enum TripHistoryAmount { Gross = 'grossPiastres', Earnings = 'earningsPiastres', Received = 'receivedPiastres', Commission = 'commissionPiastres', Tip = 'tipPiastres', Toll = 'tollPiastres', Parking = 'parkingPiastres', Waiting = 'waitingFeePiastres' }
export const TRIP_HISTORY_AMOUNTS = [
  { field: TripHistoryAmount.Earnings, label: 'trips.finance.earnings' },
  { field: TripHistoryAmount.Gross, label: 'trips.field.gross' },
  { field: TripHistoryAmount.Received, label: 'trips.field.received' },
  { field: TripHistoryAmount.Commission, label: 'trips.field.commission' },
  { field: TripHistoryAmount.Tip, label: 'trips.field.tip' },
  { field: TripHistoryAmount.Toll, label: 'trips.field.toll' },
  { field: TripHistoryAmount.Parking, label: 'trips.field.parking' },
  { field: TripHistoryAmount.Waiting, label: 'trips.ocr.waitingFee' },
];
