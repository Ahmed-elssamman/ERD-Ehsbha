import { fromBp } from '../../../common/utils/money';
import { detectEfficiencyDrop } from './fuel.engine';

export interface RecommendationCandidate {
  type: string;
  title: string;
  body: string;
  score: number;
  payload?: Record<string, unknown>;
  ttlMinutes: number;
}

export interface RecoContext {
  locale: 'ar' | 'en';
  recent7d: {
    netProfitPiastres: number;
    grossPiastres: number;
    onlineMinutes: number;
    totalKmMeters: number;
    paidKmMeters: number;
    emptyRatioBp: number;
    fuelKmPerLiter: number;
  };
  baseline90d: {
    emptyRatioBp: number;
    fuelKmPerLiter: number;
    profitPerKmPiastres: number;
  };
  appPerformance: Array<{
    driverAppId: string;
    appName: string;
    profitPerHourPiastres: number;
    onlineMinutes: number;
  }>;
  maintenance: Array<{ name: string; status: string; risk: number }>;
  fatigue: { score: number; level: 'SAFE' | 'TIRED' | 'HIGH' };
  monthlyGoal?: {
    targetPiastres: number;
    currentNetPiastres: number;
    forecastNetPiastres: number;
  };
}

const T = (locale: 'ar' | 'en', ar: string, en: string) => (locale === 'ar' ? ar : en);

export function generateRecommendations(ctx: RecoContext): RecommendationCandidate[] {
  const out: RecommendationCandidate[] = [];
  const loc = ctx.locale;

  // 1. Empty km too high
  if (
    ctx.recent7d.totalKmMeters > 10_000 &&
    ctx.baseline90d.emptyRatioBp > 0 &&
    ctx.recent7d.emptyRatioBp > ctx.baseline90d.emptyRatioBp * 1.15
  ) {
    out.push({
      type: 'empty_km_high',
      title: T(loc, 'كيلومترات فاضية كتير', 'High empty kilometers'),
      body: T(
        loc,
        `نسبة الكيلو الفاضي زادت لـ ${Math.round(fromBp(ctx.recent7d.emptyRatioBp) * 100)}% — حاول تشتغل قرب مناطقك القوية.`,
        `Your empty-km ratio jumped to ${Math.round(fromBp(ctx.recent7d.emptyRatioBp) * 100)}% — stay closer to your hotspots.`,
      ),
      score: 0.8,
      payload: { ratio: ctx.recent7d.emptyRatioBp / 10_000 },
      ttlMinutes: 60 * 24,
    });
  }

  // 2. Fuel efficiency drop
  if (detectEfficiencyDrop(ctx.recent7d.fuelKmPerLiter, ctx.baseline90d.fuelKmPerLiter, 0.1)) {
    out.push({
      type: 'fuel_efficiency_drop',
      title: T(loc, 'استهلاك بنزين زاد', 'Fuel usage went up'),
      body: T(
        loc,
        `بنزينك بقى أقل كفاءة من المعتاد. اتأكد من ضغط الكاوتش وفلتر الهوا.`,
        `Fuel efficiency dropped vs your baseline. Check tire pressure and air filter.`,
      ),
      score: 0.75,
      ttlMinutes: 60 * 24,
    });
  }

  // 3. Maintenance imminent
  const redItems = ctx.maintenance.filter((m) => m.status === 'RED' || m.status === 'OVERDUE');
  if (redItems.length > 0) {
    const top = redItems.sort((a, b) => b.risk - a.risk)[0];
    out.push({
      type: 'maintenance_imminent',
      title: T(loc, 'صيانة قربت', 'Maintenance due'),
      body: T(loc, `${top.name} محتاجة صيانة قريب جداً.`, `${top.name} needs service soon.`),
      score: 0.9,
      payload: { item: top.name, status: top.status },
      ttlMinutes: 60 * 48,
    });
  }

  // 4. Best-app recommendation
  const ranked = [...ctx.appPerformance]
    .filter((a) => a.onlineMinutes >= 60)
    .sort((a, b) => b.profitPerHourPiastres - a.profitPerHourPiastres);
  if (ranked.length >= 2) {
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    if (worst.profitPerHourPiastres > 0 && best.profitPerHourPiastres >= worst.profitPerHourPiastres * 1.15) {
      out.push({
        type: 'best_app_window',
        title: T(loc, `${best.appName} مربّح أكتر`, `${best.appName} is more profitable`),
        body: T(
          loc,
          `${best.appName} بيدخلك ${Math.round(((best.profitPerHourPiastres - worst.profitPerHourPiastres) / worst.profitPerHourPiastres) * 100)}% أكتر للساعة من ${worst.appName} الأسبوع ده.`,
          `${best.appName} is paying ${Math.round(((best.profitPerHourPiastres - worst.profitPerHourPiastres) / worst.profitPerHourPiastres) * 100)}% more per hour than ${worst.appName} this week.`,
        ),
        score: 0.85,
        payload: { bestAppId: best.driverAppId },
        ttlMinutes: 60 * 24,
      });
    }
  }

  // 5. Goal lag
  if (ctx.monthlyGoal && ctx.monthlyGoal.targetPiastres > 0) {
    const f = ctx.monthlyGoal.forecastNetPiastres;
    const t = ctx.monthlyGoal.targetPiastres;
    if (f < t * 0.9) {
      out.push({
        type: 'goal_lag',
        title: T(loc, 'هدف الشهر متأخر', 'Monthly goal lagging'),
        body: T(
          loc,
          `بنفس الإيقاع هتقفل على ${Math.round((f / t) * 100)}% من هدفك بس — حاول تضيف ساعات يوم الجمعة.`,
          `At this pace you'll close at ${Math.round((f / t) * 100)}% of your target — add hours on Friday.`,
        ),
        score: 0.8,
        ttlMinutes: 60 * 24,
      });
    }
  }

  // 6. Fatigue
  if (ctx.fatigue.level === 'HIGH') {
    out.push({
      type: 'fatigue_high',
      title: T(loc, 'إرهاق عالي', 'High fatigue'),
      body: T(loc, 'خد ٣٠ دقيقة استراحة قبل ما تكمل.', 'Take a 30-minute break before continuing.'),
      score: 0.95,
      ttlMinutes: 60,
    });
  }

  return out;
}

export function pickDailyDecisions(
  recos: RecommendationCandidate[],
  max = 3,
): RecommendationCandidate[] {
  const buckets: Record<string, RecommendationCandidate[]> = {
    earn: [],
    protect: [],
    goal: [],
  };
  for (const r of recos) {
    if (r.type === 'best_app_window' || r.type === 'empty_km_high') buckets.earn.push(r);
    else if (r.type === 'fatigue_high' || r.type === 'maintenance_imminent' || r.type === 'fuel_efficiency_drop') buckets.protect.push(r);
    else if (r.type === 'goal_lag') buckets.goal.push(r);
  }
  const picks: RecommendationCandidate[] = [];
  for (const k of ['earn', 'protect', 'goal']) {
    const list = buckets[k].sort((a, b) => b.score - a.score);
    if (list.length) picks.push(list[0]);
  }
  if (picks.length < max) {
    const remaining = recos
      .filter((r) => !picks.includes(r))
      .sort((a, b) => b.score - a.score);
    for (const r of remaining) {
      if (picks.length >= max) break;
      picks.push(r);
    }
  }
  return picks.slice(0, max);
}
