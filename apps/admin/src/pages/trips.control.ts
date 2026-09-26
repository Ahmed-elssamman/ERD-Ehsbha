export enum TripListAmount { Gross = 'grossPiastres', Earnings = 'earningsPiastres' }
export const TRIP_LIST_AMOUNTS = [
  { field: TripListAmount.Earnings, label: 'finance.earnings' },
  { field: TripListAmount.Gross, label: 'trips.grossLabel' },
];

export enum TripBulkAction { Delete = 'delete', Restore = 'restore' }

export const TRIP_ACTION_ERROR_CODES = ['TRIP_VERSION_CONFLICT', 'EXPENSE_LINK_CONFLICT', 'DAILY_DISTANCE_CONFLICT'];
