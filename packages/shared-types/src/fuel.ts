export enum FuelKind {
  Petrol80 = 'PETROL_80', Petrol92 = 'PETROL_92', Petrol95 = 'PETROL_95',
  Diesel = 'DIESEL', Cng = 'CNG', Electric = 'ELECTRIC',
}
export enum FuelQuantityUnit { Liter = 'LITER', CubicMeter = 'CUBIC_METER', KilowattHour = 'KILOWATT_HOUR' }
export enum FuelFillCoverage { Unconfirmed = 'UNCONFIRMED', Complete = 'COMPLETE', Missing = 'MISSING' }
export enum FuelChange { Created = 'CREATED', Updated = 'UPDATED', Deleted = 'DELETED', Restored = 'RESTORED' }
export enum FuelView { Active = 'active', Deleted = 'deleted' }
export enum FuelEfficiencyMethod { TankToTank = 'TANK_TO_TANK', InsufficientData = 'INSUFFICIENT_DATA' }
export enum FuelEfficiencyIssue {
  NoCompletedCycle = 'NO_COMPLETED_CYCLE', MixedVehicles = 'MIXED_VEHICLES',
  UnknownFuel = 'UNKNOWN_FUEL', UnsupportedFuel = 'UNSUPPORTED_FUEL', MixedFuel = 'MIXED_FUEL',
  MissingQuantity = 'MISSING_QUANTITY', MissingOdometer = 'MISSING_ODOMETER',
  OdometerOrder = 'ODOMETER_ORDER', AmbiguousTime = 'AMBIGUOUS_TIME',
  UnconfirmedFills = 'UNCONFIRMED_FILLS', MissingFills = 'MISSING_FILLS', InvalidRecord = 'INVALID_RECORD',
}

export interface FuelSnapshot {
  vehicleId: string;
  dateTime: string;
  fuelKind: FuelKind | null;
  quantity: number | null;
  pricePerUnitPiastres: number | null;
  totalPiastres: number;
  odometerMeters: number | null;
  isFullTank: boolean;
  fillCoverage: FuelFillCoverage;
  linkedExpenseId: string | null;
  deletedAt: string | null;
  version: number;
}

export function fuelQuantityUnit(kind: FuelKind | null): FuelQuantityUnit | null {
  if (kind === null) return null;
  if (kind === FuelKind.Cng) return FuelQuantityUnit.CubicMeter;
  if (kind === FuelKind.Electric) return FuelQuantityUnit.KilowattHour;
  return FuelQuantityUnit.Liter;
}
