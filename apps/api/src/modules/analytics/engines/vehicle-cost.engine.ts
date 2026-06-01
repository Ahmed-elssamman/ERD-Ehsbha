/**
 * Vehicle Cost Engine
 *
 * Computes operational cost per kilometer from per-component settings the driver
 * provides during vehicle setup. Each component has a cost and a usage life
 * (interval in km or months). The engine derives a per-km cost for each and
 * sums them into a total real cost per km.
 *
 * All money is in piastres (EGP × 100). All distances are in meters or km
 * depending on the field name suffix; this engine works in km internally.
 */

export interface VehicleCostInputs {
  // Fuel: tank price + km range it lasts (e.g. 222.50 EGP / 305 km).
  fuelTankCostPiastres?: number | null;
  fuelTankKmRange?: number | null;

  // Per-component: cost in piastres + lifespan in km.
  oilCostPiastres?: number | null;
  oilIntervalKm?: number | null;
  tireCostPiastres?: number | null;
  tireIntervalKm?: number | null;
  brakesCostPiastres?: number | null;
  brakesIntervalKm?: number | null;
  chainCostPiastres?: number | null;
  chainIntervalKm?: number | null;

  // Battery: lifespan in months (not km).
  batteryCostPiastres?: number | null;
  batteryIntervalMonths?: number | null;

  // Catch-all monthly overhead (insurance, license, washing, misc).
  monthlyMaintCostPiastres?: number | null;

  // Average km driven per month, used to convert time-based costs to per-km.
  // Reasonable default: 3000 km/month for a part-time driver, 6000 for full-time.
  monthlyAvgKm?: number | null;
}

export interface ComponentCost {
  key: 'fuel' | 'oil' | 'tires' | 'brakes' | 'chain' | 'battery' | 'monthly';
  perKmPiastres: number;     // 0 if input is missing
  shareBp: number;            // share of total, 0..10000
  provided: boolean;
}

export interface VehicleCostSummary {
  totalPerKmPiastres: number;
  monthlyAvgKm: number;
  components: ComponentCost[];
  completenessBp: number;     // 0..10000 — how many components had data
}

const DEFAULT_MONTHLY_KM = 3000;

export function computeVehicleCostPerKm(inputs: VehicleCostInputs): VehicleCostSummary {
  const monthlyAvgKm = inputs.monthlyAvgKm && inputs.monthlyAvgKm > 0
    ? inputs.monthlyAvgKm
    : DEFAULT_MONTHLY_KM;

  const components: ComponentCost[] = [];

  // Fuel: piastres per km = tankCost / tankKmRange
  components.push(perKmFromInterval('fuel', inputs.fuelTankCostPiastres, inputs.fuelTankKmRange));

  components.push(perKmFromInterval('oil', inputs.oilCostPiastres, inputs.oilIntervalKm));
  components.push(perKmFromInterval('tires', inputs.tireCostPiastres, inputs.tireIntervalKm));
  components.push(perKmFromInterval('brakes', inputs.brakesCostPiastres, inputs.brakesIntervalKm));
  components.push(perKmFromInterval('chain', inputs.chainCostPiastres, inputs.chainIntervalKm));

  // Battery: lifespan in months → per-km via monthlyAvgKm × intervalMonths
  if (inputs.batteryCostPiastres && inputs.batteryIntervalMonths && inputs.batteryIntervalMonths > 0) {
    const totalKmLife = monthlyAvgKm * inputs.batteryIntervalMonths;
    components.push({
      key: 'battery',
      perKmPiastres: totalKmLife > 0 ? Math.round(inputs.batteryCostPiastres / totalKmLife * 100) / 100 : 0,
      shareBp: 0,
      provided: true,
    });
  } else {
    components.push({ key: 'battery', perKmPiastres: 0, shareBp: 0, provided: false });
  }

  // Monthly maintenance overhead: monthlyCost / monthlyAvgKm
  if (inputs.monthlyMaintCostPiastres && monthlyAvgKm > 0) {
    components.push({
      key: 'monthly',
      perKmPiastres: Math.round((inputs.monthlyMaintCostPiastres / monthlyAvgKm) * 100) / 100,
      shareBp: 0,
      provided: true,
    });
  } else {
    components.push({ key: 'monthly', perKmPiastres: 0, shareBp: 0, provided: false });
  }

  const total = components.reduce((s, c) => s + c.perKmPiastres, 0);
  for (const c of components) {
    c.shareBp = total > 0 ? Math.round((c.perKmPiastres / total) * 10_000) : 0;
  }

  const providedCount = components.filter((c) => c.provided).length;
  const completenessBp = Math.round((providedCount / components.length) * 10_000);

  return {
    totalPerKmPiastres: Math.round(total * 100) / 100,
    monthlyAvgKm,
    components,
    completenessBp,
  };
}

function perKmFromInterval(
  key: ComponentCost['key'],
  costPiastres: number | null | undefined,
  intervalKm: number | null | undefined,
): ComponentCost {
  if (costPiastres && intervalKm && intervalKm > 0) {
    return {
      key,
      perKmPiastres: Math.round((costPiastres / intervalKm) * 100) / 100,
      shareBp: 0,
      provided: true,
    };
  }
  return { key, perKmPiastres: 0, shareBp: 0, provided: false };
}

/**
 * Apply vehicle cost-per-km to a distance to compute the operational cost
 * for that distance.
 */
export function operationalCostForDistance(perKmPiastres: number, meters: number): number {
  if (meters <= 0 || perKmPiastres <= 0) return 0;
  return Math.round(perKmPiastres * (meters / 1000));
}
