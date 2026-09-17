/** Legacy readings retain their value without inventing provenance. */
export enum VehicleOdometerSource {
  Unknown = 'UNKNOWN',
  Legacy = 'LEGACY',
  Manual = 'MANUAL',
  Fuel = 'FUEL',
  Ambiguous = 'AMBIGUOUS',
}
