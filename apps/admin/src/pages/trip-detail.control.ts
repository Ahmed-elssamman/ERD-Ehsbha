export enum TripMoneyField {
  Gross = 'grossPiastres', Received = 'receivedPiastres', Tip = 'tipPiastres',
  Commission = 'commissionPiastres', Toll = 'tollPiastres', Parking = 'parkingPiastres',
}
export const TRIP_MONEY_FIELDS = [
  { field: TripMoneyField.Gross, label: 'trips.grossLabel' },
  { field: TripMoneyField.Received, label: 'trips.received' },
  { field: TripMoneyField.Tip, label: 'trips.tip' },
  { field: TripMoneyField.Commission, label: 'trips.commission' },
  { field: TripMoneyField.Toll, label: 'trips.toll' },
  { field: TripMoneyField.Parking, label: 'trips.parking' },
];
