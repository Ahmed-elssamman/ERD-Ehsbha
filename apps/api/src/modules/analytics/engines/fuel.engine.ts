import { FuelEfficiencyIssue, FuelEfficiencyMethod, FuelFillCoverage, FuelKind } from '@ehsbha/shared-types';

export interface FuelPoint {
  id: string;
  vehicleId: string;
  dateTime: Date;
  fuelKind: FuelKind | null;
  quantity: number | null;
  totalPiastres: number;
  odometerMeters: number | null;
  isFullTank: boolean;
  fillCoverage: FuelFillCoverage;
}
export interface FuelEfficiencyResult {
  method: FuelEfficiencyMethod;
  kmPerLiter: number | null;
  litersPer100Km: number | null;
  costPerKmPiastres: number | null;
  cycleCount: number;
  rejectedCycleCount: number;
  recordCount: number;
  measuredFillCount: number;
  distanceMeters: number;
  quantityLiters: number;
  purchasePiastres: number;
  from: Date | null;
  to: Date | null;
  issues: FuelEfficiencyIssue[];
}
enum LiquidFuelFamily { Petrol, Diesel }
interface Cycle {
  start: FuelPoint;
  family: LiquidFuelFamily;
  lastOdometerMeters: number;
  milliLiters: bigint;
  costPiastres: bigint;
  fillCount: number;
  invalid: boolean;
}
function family(kind: FuelKind | null): LiquidFuelFamily | null {
  if (kind === FuelKind.Petrol80 || kind === FuelKind.Petrol92 || kind === FuelKind.Petrol95) return LiquidFuelFamily.Petrol;
  if (kind === FuelKind.Diesel) return LiquidFuelFamily.Diesel;
  return null;
}
function startCycle(point: FuelPoint): Cycle | null {
  const fuelFamily = family(point.fuelKind);
  if (!point.isFullTank || fuelFamily === null || point.odometerMeters === null) return null;
  return { start: point, family: fuelFamily, lastOdometerMeters: point.odometerMeters, milliLiters: 0n, costPiastres: 0n, fillCount: 0, invalid: false };
}
function validPoint(point: FuelPoint): boolean {
  return Number.isFinite(point.dateTime.getTime()) && Number.isSafeInteger(point.totalPiastres) && point.totalPiastres >= 0
    && (point.odometerMeters === null || (Number.isSafeInteger(point.odometerMeters) && point.odometerMeters >= 0))
    && (point.quantity === null || (Number.isFinite(point.quantity) && point.quantity > 0 && point.quantity <= 9999.999
      && Math.abs(point.quantity * 1000 - Math.round(point.quantity * 1000)) < 0.000001));
}

/** Liquid fuel only. Every completed cycle needs the driver's fill-coverage confirmation. */
export function computeFuelEfficiency(points: FuelPoint[]): FuelEfficiencyResult {
  const result: FuelEfficiencyResult = { method: FuelEfficiencyMethod.InsufficientData, kmPerLiter: null, litersPer100Km: null,
    costPerKmPiastres: null, cycleCount: 0, rejectedCycleCount: 0, recordCount: points.length, measuredFillCount: 0,
    distanceMeters: 0, quantityLiters: 0, purchasePiastres: 0, from: null, to: null, issues: [] };
  const issues = new Set<FuelEfficiencyIssue>();
  if (new Set(points.map((point) => point.vehicleId)).size > 1) return { ...result, issues: [FuelEfficiencyIssue.MixedVehicles] };
  const liquidFamilies = new Set(points.map((point) => family(point.fuelKind)).filter((value) => value !== null));
  if (liquidFamilies.size > 1) return { ...result, issues: [FuelEfficiencyIssue.MixedFuel] };
  const sorted = [...points].sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime() || a.id.localeCompare(b.id));
  let cycle: Cycle | null = null;
  let distance = 0n;
  let milliLiters = 0n;
  let cost = 0n;
  for (let index = 0; index < sorted.length; index++) {
    const point = sorted[index];
    if (!validPoint(point)) {
      issues.add(FuelEfficiencyIssue.InvalidRecord);
      if (cycle) cycle.invalid = true;
      continue;
    }
    const time = point.dateTime.getTime();
    if (sorted[index - 1]?.dateTime.getTime() === time || sorted[index + 1]?.dateTime.getTime() === time) {
      issues.add(FuelEfficiencyIssue.AmbiguousTime);
      if (cycle) { cycle.invalid = true; if (point.isFullTank) result.rejectedCycleCount++; }
      cycle = null;
      continue;
    }
    const fuelFamily = family(point.fuelKind);
    if (fuelFamily === null) issues.add(point.fuelKind === null ? FuelEfficiencyIssue.UnknownFuel : FuelEfficiencyIssue.UnsupportedFuel);
    if (!cycle) {
      if (point.isFullTank && point.odometerMeters === null) issues.add(FuelEfficiencyIssue.MissingOdometer);
      cycle = startCycle(point);
      continue;
    }
    if (fuelFamily !== cycle.family) { cycle.invalid = true; issues.add(FuelEfficiencyIssue.MixedFuel); }
    if (point.quantity === null) { cycle.invalid = true; issues.add(FuelEfficiencyIssue.MissingQuantity); }
    else cycle.milliLiters += BigInt(Math.round(point.quantity * 1000));
    cycle.costPiastres += BigInt(point.totalPiastres);
    cycle.fillCount++;
    if (point.odometerMeters !== null) {
      if (point.odometerMeters < cycle.lastOdometerMeters) { cycle.invalid = true; issues.add(FuelEfficiencyIssue.OdometerOrder); }
      cycle.lastOdometerMeters = point.odometerMeters;
    }
    if (point.fillCoverage === FuelFillCoverage.Missing) { cycle.invalid = true; issues.add(FuelEfficiencyIssue.MissingFills); }
    if (!point.isFullTank) continue;
    if (point.odometerMeters === null) { cycle.invalid = true; issues.add(FuelEfficiencyIssue.MissingOdometer); }
    if (point.fillCoverage !== FuelFillCoverage.Complete) {
      cycle.invalid = true;
      issues.add(point.fillCoverage === FuelFillCoverage.Missing ? FuelEfficiencyIssue.MissingFills : FuelEfficiencyIssue.UnconfirmedFills);
    }
    const cycleDistance = (point.odometerMeters ?? 0) - (cycle.start.odometerMeters ?? 0);
    if (cycleDistance <= 0) { cycle.invalid = true; issues.add(FuelEfficiencyIssue.OdometerOrder); }
    if (!cycle.invalid && cycle.milliLiters > 0n) {
      distance += BigInt(cycleDistance);
      milliLiters += cycle.milliLiters;
      cost += cycle.costPiastres;
      result.cycleCount++;
      result.measuredFillCount += cycle.fillCount;
      result.from ??= cycle.start.dateTime;
      result.to = point.dateTime;
    } else result.rejectedCycleCount++;
    cycle = startCycle(point);
  }
  if (result.cycleCount) {
    if (![distance, milliLiters, cost].every((value) => value <= BigInt(Number.MAX_SAFE_INTEGER))) {
      return { ...result, issues: [...issues, FuelEfficiencyIssue.InvalidRecord] };
    }
    result.method = FuelEfficiencyMethod.TankToTank;
    result.distanceMeters = Number(distance);
    result.quantityLiters = Number(milliLiters) / 1000;
    result.purchasePiastres = Number(cost);
    result.kmPerLiter = Number(distance) / Number(milliLiters);
    result.litersPer100Km = Number(milliLiters) * 100 / Number(distance);
    result.costPerKmPiastres = Number((cost * 2000n + distance) / (2n * distance));
    if (!Number.isSafeInteger(result.costPerKmPiastres)) {
      result.costPerKmPiastres = null;
      issues.add(FuelEfficiencyIssue.InvalidRecord);
    }
  } else issues.add(FuelEfficiencyIssue.NoCompletedCycle);
  result.issues = [...issues];
  return result;
}

export function detectEfficiencyDrop(recent: number | null, baseline: number | null, threshold = 0.1): boolean {
  if (recent === null || baseline === null || recent <= 0 || baseline <= 0) return false;
  return (baseline - recent) / baseline >= threshold;
}
