export enum ExpenseCategory {
  Rent = 'RENT', Insurance = 'INSURANCE', Fine = 'FINE', Toll = 'TOLL', Food = 'FOOD',
  Phone = 'PHONE', Wash = 'WASH', Parking = 'PARKING', Other = 'OTHER',
}

export enum ExpenseChange { Created = 'CREATED', Updated = 'UPDATED', Deleted = 'DELETED', Restored = 'RESTORED' }
export enum ExpenseView { Active = 'active', Deleted = 'deleted' }

export interface ExpenseSnapshot {
  vehicleId: string | null;
  category: ExpenseCategory;
  amountPiastres: number;
  dateTime: string;
  linkedTripId: string | null;
  isRecurring: boolean;
  recurrenceRule: string | null;
  deletedAt: string | null;
  version: number;
}
