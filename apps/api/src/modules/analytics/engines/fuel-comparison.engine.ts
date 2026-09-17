import type { Locale } from '@ehsbha/shared-types';
import { computeFuelEfficiency, detectEfficiencyDrop, type FuelPoint } from './fuel.engine';
import type { RecommendationCandidate } from './recommendation.engine';
import { FUEL_COMPARISON_COPY } from './fuel-comparison.control';
import { FUEL_COMPARISON_MINIMUM_CYCLES } from '../../fuel/fuel.control';

export interface FuelComparisonVehicle { id: string; label: string; points: FuelPoint[] }

/** The caller provides the 90-day window; boundary timestamps belong to the recent window only. */
export function fuelComparisonRecommendations(vehicles: FuelComparisonVehicle[], recentStart: Date, locale: Locale): RecommendationCandidate[] {
  const results: RecommendationCandidate[] = [];
  for (const vehicle of vehicles) {
    if (vehicle.points.some((point) => point.vehicleId !== vehicle.id)) continue;
    const baseline = computeFuelEfficiency(vehicle.points.filter((point) => point.dateTime < recentStart));
    const recent = computeFuelEfficiency(vehicle.points.filter((point) => point.dateTime >= recentStart));
    if (baseline.cycleCount < FUEL_COMPARISON_MINIMUM_CYCLES || recent.cycleCount < FUEL_COMPARISON_MINIMUM_CYCLES
      || baseline.kmPerLiter === null || recent.kmPerLiter === null || !baseline.from || !baseline.to || !recent.from || !recent.to
      || !detectEfficiencyDrop(recent.kmPerLiter, baseline.kmPerLiter, 0.1)) continue;
    // A fuel conversion between windows cannot be treated as a change in economy.
    const families = new Set(vehicle.points.map((point) => point.fuelKind?.startsWith('PETROL_') ? 'PETROL' : point.fuelKind));
    if (families.size !== 1) continue;
    const decrease = Math.round((1 - recent.kmPerLiter / baseline.kmPerLiter) * 100);
    const copy = FUEL_COMPARISON_COPY[locale];
    results.push({ type: 'fuel_efficiency_drop', title: copy.title,
      body: copy.body.replace('{vehicle}', vehicle.label).replace('{drop}', new Intl.NumberFormat(locale).format(decrease)),
      score: 0.75, ttlMinutes: 60 * 24, payload: { vehicleId: vehicle.id, method: recent.method,
        baselineKmPerLiter: baseline.kmPerLiter, recentKmPerLiter: recent.kmPerLiter,
        baselineCycleCount: baseline.cycleCount, recentCycleCount: recent.cycleCount,
        baselineFrom: baseline.from.toISOString(), baselineTo: baseline.to.toISOString(),
        recentFrom: recent.from.toISOString(), recentTo: recent.to.toISOString() } });
  }
  return results;
}
