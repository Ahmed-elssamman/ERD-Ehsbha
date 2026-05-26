import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { addDays, startOfUtcDay } from '../../common/utils/date';
import { NotificationsService } from './notifications.service';

interface DriverInsights {
  todayTargetPiastres: number | null;
  monthlyGoalPiastres: number | null;
  earnedThisMonthPiastres: number;
  remainingDaysInMonth: number;
  bestHour: { hour: number; netEgpPerHr: number } | null;
  bestAppForDow: { appId: string; appName: string; netPiastres: number } | null;
  lowEgpPerKmArea: { areaId: string; areaName: string; egpPerKm: number } | null;
  emptyKmRatioYesterday: number | null;
  yesterdayNetPiastres: number;
}

interface DigestPayload {
  title: string;
  body: string;
  data: {
    kind: 'DAILY_DIGEST';
    locale: 'ar' | 'en';
    insights: DriverInsights;
    tips: Array<{ key: string; vars: Record<string, string | number> }>;
  };
}

/**
 * Produces a personalised "morning digest" notification for every driver
 * once a day. Each digest carries:
 *
 *   1. Today's target — derived from the driver's active MONTHLY goal,
 *      what they've already earned this month, and how many days remain.
 *      Keeps adjusting daily so a slow start still translates into a
 *      reachable per-day number.
 *   2. Up to three personalised tips, picked from the driver's OWN
 *      analytics — best hour of day, top-earning app for today's
 *      day-of-week, areas where their EGP/km dips below average,
 *      empty-km warnings, etc. No generic advice — every tip cites a
 *      specific number from their own history.
 *
 * The cron fires at 06:30 UTC = 08:30 Cairo (Egypt has no DST since 2014),
 * which lands on a typical driver's morning. The notification is stored
 * in-app; the existing notifications inbox renders it.
 */
@Injectable()
export class DailyDigestService {
  private readonly logger = new Logger(DailyDigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('30 6 * * *', { name: 'daily-digest', timeZone: 'UTC' })
  async runForAllDrivers(): Promise<void> {
    const drivers = await this.prisma.driver.findMany({
      where: { user: { status: 'ACTIVE' } },
      select: { id: true },
    });
    this.logger.log(`Daily digest starting for ${drivers.length} drivers`);
    let sent = 0;
    let failed = 0;
    for (const d of drivers) {
      try {
        const created = await this.generateForDriver(d.id);
        if (created) sent += 1;
      } catch (err) {
        failed += 1;
        this.logger.warn(`Digest failed for ${d.id}: ${(err as Error).message}`);
      }
    }
    this.logger.log(`Daily digest done — sent=${sent} failed=${failed}`);
  }

  /**
   * Builds and stores the digest for one driver. Returns the notification
   * id when sent, or `null` when there isn't enough history to say anything
   * meaningful (we don't spam drivers with empty tips on their first day).
   */
  async generateForDriver(driverId: string): Promise<string | null> {
    const insights = await this.computeInsights(driverId);
    const hasTarget = insights.todayTargetPiastres != null && insights.todayTargetPiastres > 0;
    const hasAnyTip =
      insights.bestHour != null ||
      insights.bestAppForDow != null ||
      insights.lowEgpPerKmArea != null ||
      insights.emptyKmRatioYesterday != null;
    if (!hasTarget && !hasAnyTip) {
      // Brand-new driver with no goal + no history → nothing useful to say.
      return null;
    }

    const payload = this.buildArabicPayload(insights);
    const n = await this.notifications.create(driverId, payload.title, payload.body, payload.data);
    return n.id;
  }

  /**
   * Pulls 30 days of trips + the driver's monthly goal + yesterday's
   * aggregates into a compact shape the message builder can consume.
   */
  private async computeInsights(driverId: string): Promise<DriverInsights> {
    const today = startOfUtcDay(new Date());
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
    const remainingDays = Math.max(
      1,
      Math.floor((monthEnd.getTime() - today.getTime()) / 86_400_000) + 1,
    );

    // 1) Monthly goal + earned-this-month → today's target.
    const monthlyGoal = await this.prisma.goal.findFirst({
      where: {
        driverId,
        period: 'MONTHLY',
        isActive: true,
        startsOn: { lte: today },
        endsOn: { gte: today },
      },
      orderBy: { startsOn: 'desc' },
    });
    const monthDailies = await this.prisma.dailyAggregate.findMany({
      where: { driverId, date: { gte: monthStart, lt: today } },
      select: { netProfitPiastres: true },
    });
    const earnedThisMonthPiastres = monthDailies.reduce(
      (s, r) => s + Number(r.netProfitPiastres),
      0,
    );
    const todayTargetPiastres = monthlyGoal
      ? Math.max(
          0,
          Math.round(
            (Number(monthlyGoal.targetPiastres) - earnedThisMonthPiastres) / remainingDays,
          ),
        )
      : null;

    // 2) Best hour of day from the last 30 days of trips.
    const trips30 = await this.prisma.trip.findMany({
      where: { driverId, startedAt: { gte: addDays(today, -30) } },
      select: {
        startedAt: true,
        endedAt: true,
        grossPiastres: true,
        commissionPiastres: true,
        tipPiastres: true,
        driverAppId: true,
        areaId: true,
        paidKmMeters: true,
        totalKmMeters: true,
      },
    });
    const bestHour = pickBestHour(trips30);

    // 3) Best app for today's day-of-week (Sun=0..Sat=6 UTC).
    const dow = today.getUTCDay();
    const tripsForDow = trips30.filter((t) => t.startedAt.getUTCDay() === dow);
    const bestAppForDow = await this.pickBestAppForDow(tripsForDow);

    // 4) Area where the driver's EGP/km has been historically low.
    const lowEgpPerKmArea = await this.pickWorstArea(trips30);

    // 5) Yesterday: net + empty-km ratio.
    const yest = addDays(today, -1);
    const yda = await this.prisma.dailyAggregate.findFirst({
      where: { driverId, date: yest },
      select: { netProfitPiastres: true, totalKmMeters: true, emptyKmMeters: true },
    });
    const yesterdayNetPiastres = yda ? Number(yda.netProfitPiastres) : 0;
    const totalKm = yda ? Number(yda.totalKmMeters) : 0;
    const emptyKm = yda ? Number(yda.emptyKmMeters) : 0;
    const emptyKmRatioYesterday = totalKm > 0 ? emptyKm / totalKm : null;

    return {
      todayTargetPiastres,
      monthlyGoalPiastres: monthlyGoal ? Number(monthlyGoal.targetPiastres) : null,
      earnedThisMonthPiastres,
      remainingDaysInMonth: remainingDays,
      bestHour,
      bestAppForDow,
      lowEgpPerKmArea,
      emptyKmRatioYesterday,
      yesterdayNetPiastres,
    };
  }

  private async pickBestAppForDow(
    trips: Array<{ driverAppId: string; grossPiastres: number; commissionPiastres: number; tipPiastres: number }>,
  ): Promise<DriverInsights['bestAppForDow']> {
    if (trips.length === 0) return null;
    const byApp = new Map<string, number>();
    for (const t of trips) {
      const net = t.grossPiastres + t.tipPiastres - t.commissionPiastres;
      byApp.set(t.driverAppId, (byApp.get(t.driverAppId) ?? 0) + net);
    }
    let bestId: string | null = null;
    let bestNet = -Infinity;
    for (const [id, net] of byApp) {
      if (net > bestNet) {
        bestNet = net;
        bestId = id;
      }
    }
    if (!bestId) return null;
    const app = await this.prisma.driverApp.findUnique({
      where: { id: bestId },
      include: { appSource: { select: { name: true } } },
    });
    if (!app) return null;
    return {
      appId: app.id,
      appName: app.customName ?? app.appSource?.name ?? 'App',
      netPiastres: bestNet,
    };
  }

  private async pickWorstArea(
    trips: Array<{ areaId: string | null; grossPiastres: number; commissionPiastres: number; tipPiastres: number; paidKmMeters: number }>,
  ): Promise<DriverInsights['lowEgpPerKmArea']> {
    const stats = new Map<string, { net: number; km: number }>();
    for (const t of trips) {
      if (!t.areaId || t.paidKmMeters <= 0) continue;
      const net = t.grossPiastres + t.tipPiastres - t.commissionPiastres;
      const cur = stats.get(t.areaId) ?? { net: 0, km: 0 };
      cur.net += net;
      cur.km += t.paidKmMeters;
      stats.set(t.areaId, cur);
    }
    // Require at least 5 trips' worth of distance (≈ 20 km) to be statistically
    // meaningful — a single short trip with a low fare shouldn't blacklist
    // an area.
    const ranked: Array<{ areaId: string; egpPerKm: number }> = [];
    for (const [areaId, { net, km }] of stats) {
      if (km < 20_000) continue;
      ranked.push({ areaId, egpPerKm: (net / 100) / (km / 1000) });
    }
    if (ranked.length < 2) return null;
    ranked.sort((a, b) => a.egpPerKm - b.egpPerKm);
    const worst = ranked[0];
    const median = ranked[Math.floor(ranked.length / 2)];
    // Only warn when the worst area is materially below the median.
    if (worst.egpPerKm >= median.egpPerKm * 0.8) return null;
    const area = await this.prisma.area.findUnique({ where: { id: worst.areaId } });
    if (!area) return null;
    return {
      areaId: area.id,
      areaName: area.name,
      egpPerKm: Number(worst.egpPerKm.toFixed(2)),
    };
  }

  /**
   * Compose the Arabic-locale digest text + structured data. The data block
   * carries everything the frontend needs to re-render in either language
   * if we extend the inbox to localise inline.
   */
  private buildArabicPayload(insights: DriverInsights): DigestPayload {
    const tips: DigestPayload['data']['tips'] = [];
    const lines: string[] = [];

    if (insights.todayTargetPiastres != null) {
      const egp = Math.round(insights.todayTargetPiastres / 100);
      lines.push(`هدف اليوم: ${egp} ج.م لتحقيق هدفك الشهري.`);
      tips.push({ key: 'tip.todayTarget', vars: { egp, days: insights.remainingDaysInMonth } });
    }

    if (insights.bestHour) {
      const hr = insights.bestHour.hour;
      const display = formatHour(hr);
      const egpHr = Math.round(insights.bestHour.netEgpPerHr / 100);
      lines.push(`الساعة ${display} هي أفضل ساعاتك (~${egpHr} ج.م/ساعة). جهّز نفسك قبلها.`);
      tips.push({ key: 'tip.bestHour', vars: { hour: hr, display, egpHr } });
    }

    if (insights.bestAppForDow) {
      lines.push(`أعلى ربح في مثل هذا اليوم بيجي من ${insights.bestAppForDow.appName} — ابدأ بيه.`);
      tips.push({ key: 'tip.bestApp', vars: { name: insights.bestAppForDow.appName } });
    }

    if (insights.lowEgpPerKmArea) {
      const v = insights.lowEgpPerKmArea.egpPerKm;
      lines.push(
        `تجنّب الرحلات الطويلة في ${insights.lowEgpPerKmArea.areaName} — السعر/كم عندك (${v} ج.م) أقل من المعتاد.`,
      );
      tips.push({
        key: 'tip.avoidArea',
        vars: { area: insights.lowEgpPerKmArea.areaName, egpPerKm: v },
      });
    }

    if (insights.emptyKmRatioYesterday != null && insights.emptyKmRatioYesterday > 0.35) {
      const pct = Math.round(insights.emptyKmRatioYesterday * 100);
      lines.push(
        `إمبارح ${pct}% من كيلومتراتك كانت فاضية. حاول تستنى الطلب الجاي في نفس المنطقة بدل ما ترجع.`,
      );
      tips.push({ key: 'tip.emptyKm', vars: { pct } });
    }

    const title =
      insights.todayTargetPiastres != null
        ? `يومك بدأ — هدفك ${Math.round(insights.todayTargetPiastres / 100)} ج.م`
        : 'نصايح اليوم من Ehsbha';
    const body = lines.length > 0 ? lines.join(' ') : 'سجّل رحلاتك ومصاريفك لتحصل على نصايح أدق غدًا.';

    return {
      title,
      body,
      data: {
        kind: 'DAILY_DIGEST',
        locale: 'ar',
        insights,
        tips,
      },
    };
  }
}

/**
 * Bucket each trip into the hour it started, compute net EGP per hour worked
 * (using the trip duration as the time spent), then surface the hour with
 * the highest average earnings per hour. Requires at least 3 trips in the
 * winning bucket so a single lucky trip doesn't dominate.
 */
function pickBestHour(
  trips: Array<{
    startedAt: Date;
    endedAt: Date;
    grossPiastres: number;
    commissionPiastres: number;
    tipPiastres: number;
  }>,
): DriverInsights['bestHour'] {
  if (trips.length === 0) return null;
  const buckets = new Map<number, { net: number; minutes: number; count: number }>();
  for (const t of trips) {
    const minutes = Math.max(1, (t.endedAt.getTime() - t.startedAt.getTime()) / 60_000);
    const net = t.grossPiastres + t.tipPiastres - t.commissionPiastres;
    const hour = t.startedAt.getUTCHours();
    const cur = buckets.get(hour) ?? { net: 0, minutes: 0, count: 0 };
    cur.net += net;
    cur.minutes += minutes;
    cur.count += 1;
    buckets.set(hour, cur);
  }
  let bestHour: number | null = null;
  let bestEgpPerHr = -Infinity;
  for (const [hour, b] of buckets) {
    if (b.count < 3) continue;
    const perHr = (b.net / b.minutes) * 60;
    if (perHr > bestEgpPerHr) {
      bestEgpPerHr = perHr;
      bestHour = hour;
    }
  }
  if (bestHour == null) return null;
  return { hour: bestHour, netEgpPerHr: Math.round(bestEgpPerHr) };
}

function formatHour(h24: number): string {
  // Render 12-hour Arabic-style ("7 م", "11 ص") because that's what drivers
  // think in. UTC vs local is intentional simplification — Egypt sits at
  // UTC+2 year-round (no DST), close enough for a soft hint.
  const localApprox = (h24 + 2) % 24; // UTC → Cairo approx
  const suffix = localApprox >= 12 ? 'م' : 'ص';
  const h12 = localApprox % 12 === 0 ? 12 : localApprox % 12;
  return `${h12} ${suffix}`;
}
