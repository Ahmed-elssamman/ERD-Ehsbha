export enum MaintenanceChange { Created = 'CREATED', Updated = 'UPDATED', Deleted = 'DELETED', Restored = 'RESTORED' }
export enum MaintenanceView { Active = 'active', Deleted = 'deleted' }
export enum OperatingCostBasis { Recorded = 'recorded_cash_costs' }
export enum MaintenanceStatus { Unknown = 'UNKNOWN', Green = 'GREEN', Amber = 'AMBER', Red = 'RED', Overdue = 'OVERDUE' }

export interface MaintenanceSnapshot {
  vehicleId: string;
  maintenanceItemId: string;
  performedAt: string;
  odometerMeters: number;
  costPiastres: number;
  linkedExpenseId: string | null;
  deletedAt: string | null;
  version: number;
}
