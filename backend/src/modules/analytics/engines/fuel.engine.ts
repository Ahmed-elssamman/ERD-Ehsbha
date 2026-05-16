export interface FuelPoint {
  dateTime: Date;
  liters: number;
  totalPiastres: number;
  odometerMeters: number;
  isFullTank: boolean;
}

export interface FuelEfficiencyResult {
  kmPerLiter: number;
  method: 'TANK_TO_TANK' | 'ROLLING' | 'INSUFFICIENT_DATA';
  costPerKmPiastres: number;
  sampleCount: number;
}

export function computeFuelEfficiency(points: FuelPoint[]): FuelEfficiencyResult {
  const sorted = [...points].sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
  const fulls = sorted.filter((p) => p.isFullTank);

  if (fulls.length >= 2) {
    let totalKm = 0;
    let totalLiters = 0;
    let totalCost = 0;
    for (let i = 1; i < fulls.length; i++) {
      const km = (fulls[i].odometerMeters - fulls[i - 1].odometerMeters) / 1000;
      if (km <= 0) continue;
      const start = fulls[i - 1].dateTime.getTime();
      const end = fulls[i].dateTime.getTime();
      let liters = 0;
      let cost = 0;
      for (const p of sorted) {
        const t = p.dateTime.getTime();
        if (t > start && t <= end) {
          liters += p.liters;
          cost += p.totalPiastres;
        }
      }
      if (liters > 0) {
        totalKm += km;
        totalLiters += liters;
        totalCost += cost;
      }
    }
    if (totalKm > 0 && totalLiters > 0) {
      return {
        kmPerLiter: totalKm / totalLiters,
        method: 'TANK_TO_TANK',
        costPerKmPiastres: totalKm > 0 ? Math.round(totalCost / totalKm) : 0,
        sampleCount: fulls.length,
      };
    }
  }

  const liters = sorted.reduce((s, p) => s + p.liters, 0);
  const cost = sorted.reduce((s, p) => s + p.totalPiastres, 0);
  if (sorted.length >= 2 && liters > 0) {
    const km = (sorted[sorted.length - 1].odometerMeters - sorted[0].odometerMeters) / 1000;
    if (km > 0) {
      return {
        kmPerLiter: km / liters,
        method: 'ROLLING',
        costPerKmPiastres: Math.round(cost / km),
        sampleCount: sorted.length,
      };
    }
  }

  return { kmPerLiter: 0, method: 'INSUFFICIENT_DATA', costPerKmPiastres: 0, sampleCount: sorted.length };
}

export function detectEfficiencyDrop(recent: number, baseline: number, threshold = 0.1): boolean {
  if (recent <= 0 || baseline <= 0) return false;
  return (baseline - recent) / baseline >= threshold;
}
