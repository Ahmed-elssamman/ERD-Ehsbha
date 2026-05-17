import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Coins,
  Gauge,
  HeartHandshake,
  Lightbulb,
  Shield,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n';
import { AnalyticsApi, ScoreApi } from '@/lib/api/endpoints';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

const RING_SIZE = 168;
const STROKE = 14;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

function scoreColor(score: number): string {
  if (score >= 80) return 'hsl(var(--success))';
  if (score >= 60) return 'hsl(var(--primary))';
  if (score >= 40) return 'hsl(var(--warning))';
  return 'hsl(var(--destructive))';
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/* -------- Wellness storage ---------------------------------------------- */

type Feeling = 'great' | 'ok' | 'tired' | 'exhausted';
type Weather = 'clear' | 'rain' | 'heat' | 'traffic';

interface CheckIn {
  date: string;
  sleepHours: number;
  continuousMinutes: number;
  totalHours: number;
  feeling: Feeling;
  stress: number; // 1-10
  breaks: number;
  hydration: boolean;
  lastMealHours: number;
  weather: Weather;
}

const STORAGE_KEY = 'ehsbha.wellness';
const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const defaultCheckIn = (date: string): CheckIn => ({
  date,
  sleepHours: 0,
  continuousMinutes: 0,
  totalHours: 0,
  feeling: 'ok',
  stress: 3,
  breaks: 0,
  hydration: true,
  lastMealHours: 0,
  weather: 'clear',
});

function loadCheckIn(date: string): CheckIn | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, Partial<CheckIn>>;
    if (!all[date]) return null;
    return { ...defaultCheckIn(date), ...all[date] } as CheckIn;
  } catch {
    return null;
  }
}

function saveCheckIn(c: CheckIn) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = (raw ? JSON.parse(raw) : {}) as Record<string, CheckIn>;
    all[c.date] = c;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

/** Fatigue score 0..1 from wellness check. */
function computeFatigueScore(c: CheckIn): number {
  const feelingScore = c.feeling === 'great' ? 0 : c.feeling === 'ok' ? 0.2 : c.feeling === 'tired' ? 0.6 : 1;
  const sleepScore = c.sleepHours >= 7 ? 0 : c.sleepHours >= 5 ? 0.4 : c.sleepHours > 0 ? 0.9 : 0; // missing data → no penalty
  const continuousScore = c.continuousMinutes < 90 ? 0 : c.continuousMinutes < 180 ? 0.5 : 1;
  const totalScore = c.totalHours < 6 ? 0 : c.totalHours < 10 ? 0.5 : 1;
  const stressScore = clamp((c.stress - 1) / 9, 0, 1);
  const hydrationScore = c.hydration ? 0 : 0.3;
  const mealScore = c.lastMealHours > 6 ? 0.4 : c.lastMealHours > 4 ? 0.2 : 0;
  const breaksScore = c.totalHours >= 4 && c.breaks === 0 ? 0.3 : 0;
  const weatherScore = c.weather === 'clear' ? 0 : c.weather === 'traffic' ? 0.15 : 0.25;

  return clamp(
    0.25 * feelingScore +
      0.20 * sleepScore +
      0.15 * continuousScore +
      0.15 * totalScore +
      0.08 * stressScore +
      0.05 * hydrationScore +
      0.04 * mealScore +
      0.04 * breaksScore +
      0.04 * weatherScore,
    0,
    1,
  );
}

function fatigueLevel(score: number): 'low' | 'moderate' | 'high' {
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'moderate';
  return 'low';
}

/* -------- Main page ----------------------------------------------------- */

export function DriverScorePage() {
  const { t, locale } = useI18n();
  const todayQ = useQuery({ queryKey: ['score', 'today'], queryFn: ScoreApi.today });
  const histQ = useQuery({ queryKey: ['score', 'history'], queryFn: () => ScoreApi.history() });
  const analyticsQ = useQuery({ queryKey: ['analytics', 'today'], queryFn: AnalyticsApi.today });

  const date = todayKey();
  const [checkIn, setCheckIn] = useState<CheckIn>(() => loadCheckIn(date) ?? defaultCheckIn(date));

  const fatigueRaw = computeFatigueScore(checkIn);
  const fatigue = fatigueLevel(fatigueRaw);

  const base = todayQ.data;
  // Recompute safety with wellness fatigue: backend hardcodes fatigueScore=0 so its safety
  // never reflects fatigue. Apply a fatigue penalty (max -60) on top of the backend's safety.
  const adjustedSafety = base
    ? clamp(Math.round(base.safety - fatigueRaw * 60), 0, 100)
    : 0;
  const adjustedOverall = base
    ? Math.round(0.35 * base.efficiency + 0.25 * base.profit + 0.25 * adjustedSafety + 0.15 * base.consistency)
    : 0;

  const overall = adjustedOverall;
  const dashOffset = CIRC - (CIRC * overall) / 100;
  const color = scoreColor(overall);

  const history = (histQ.data ?? []).slice(-14);
  const chartData = history.map((h) => ({
    date: formatDate(h.date, locale, { day: 'numeric', month: 'short' }),
    overall: h.overall,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title={t('score.title')} subtitle={t('score.subtitle')} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Hero */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" aria-hidden />
                {t('score.overall')}
              </span>
              {base && adjustedSafety !== base.safety ? (
                <Badge variant="muted" className="text-[10px]">
                  <Sparkles className="h-3 w-3" /> {t('score.adjusted')}
                </Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayQ.isLoading ? (
              <div className="grid place-items-center"><Skeleton className="h-40 w-40 rounded-full" /></div>
            ) : !base ? (
              <EmptyState Icon={Gauge} title={t('score.empty')} />
            ) : (
              <>
                <div className="grid place-items-center">
                  <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
                    <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
                      <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS} fill="none" stroke="hsl(var(--muted))" strokeWidth={STROKE} />
                      <motion.circle
                        cx={RING_SIZE / 2}
                        cy={RING_SIZE / 2}
                        r={RADIUS}
                        fill="none"
                        stroke={color}
                        strokeWidth={STROKE}
                        strokeLinecap="round"
                        strokeDasharray={CIRC}
                        initial={{ strokeDashoffset: CIRC }}
                        animate={{ strokeDashoffset: dashOffset }}
                        transition={{ duration: 0.9, ease: 'easeOut' }}
                      />
                    </svg>
                    <div className="absolute inset-0 grid place-items-center text-center">
                      <div>
                        <p className="num-tabular text-4xl font-bold">{formatNumber(overall, locale)}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">/ 100</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <SubScore label={t('score.efficiency')} value={base.efficiency} Icon={Activity} />
                  <SubScore label={t('score.profit')} value={base.profit} Icon={Coins} />
                  <SubScore
                    label={t('score.safety')}
                    value={adjustedSafety}
                    Icon={Shield}
                    hint={fatigueRaw > 0 ? `${t('score.fatigueLevel')}: ${t(`score.fatigue.${fatigue}`)}` : undefined}
                  />
                  <SubScore label={t('score.consistency')} value={base.consistency} Icon={Gauge} />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* History chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('score.history')}</CardTitle>
          </CardHeader>
          <CardContent>
            {histQ.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : chartData.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">{t('common.noData')}</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <defs>
                      <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 12,
                        color: 'hsl(var(--card-foreground))',
                      }}
                    />
                    <Area type="monotone" dataKey="overall" stroke="hsl(var(--primary))" fill="url(#scoreFill)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <FactorsCard analytics={analyticsQ.data} historyDays={history.length} />

      <WellnessCheckCard checkIn={checkIn} setCheckIn={setCheckIn} fatigue={fatigue} fatigueRaw={fatigueRaw} />

      <TipsCard
        base={base ?? null}
        adjustedSafety={adjustedSafety}
        checkIn={checkIn}
        fatigueRaw={fatigueRaw}
      />
    </div>
  );
}

/* -------- Sub-score card ------------------------------------------------ */

function SubScore({
  label,
  value,
  Icon,
  hint,
}: {
  label: string;
  value: number;
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  hint?: string;
}) {
  const { locale } = useI18n();
  const color = scoreColor(value);
  return (
    <div className="rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-center">
      <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </div>
      <p className="num-tabular mt-0.5 text-base font-semibold" style={{ color }}>
        {formatNumber(value, locale)}
      </p>
      {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/* -------- Factors breakdown -------------------------------------------- */

function FactorsCard({
  analytics,
  historyDays,
}: {
  analytics?: import('@/lib/api/endpoints').DailyAnalytics;
  historyDays: number;
}) {
  const { t, locale } = useI18n();
  const tripCount = analytics?.tripCount ?? 0;
  const lowData = historyDays < 3 || tripCount < 3;

  const ppk = analytics?.profitPerKmPiastres ?? 0;
  const net = analytics?.netProfitPiastres ?? 0;
  const onlineMin = analytics?.onlineMinutes ?? 0;
  const emptyBp = analytics?.emptyRatioBp ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{t('score.factors.title')}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{t('score.factors.subtitle')}</p>
        </div>
        <Badge variant={lowData ? 'warning' : 'muted'} className="text-[10px]">
          {t('score.dataQuality.label')} ·{' '}
          {t('score.dataQuality.trips', { count: String(tripCount) }) as string}
          {' · '}
          {t('score.dataQuality.history', { count: String(historyDays) }) as string}
        </Badge>
      </CardHeader>
      <CardContent>
        {lowData ? (
          <p className="mb-3 rounded-lg border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
            {t('score.dataQuality.low')}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FactorTile
            label={t('score.factors.profitPerKm')}
            value={formatMoney(ppk, locale)}
            hint={`${t('common.perKm')} · ${t('score.factors.profitPerKmVs')}`}
            tone={ppk >= 0 ? 'success' : 'destructive'}
          />
          <FactorTile
            label={t('score.factors.netToday')}
            value={formatMoney(net, locale)}
            hint={t('score.factors.netVs')}
            tone={net >= 0 ? 'success' : 'destructive'}
          />
          <FactorTile
            label={t('score.factors.emptyRatio')}
            value={`${(emptyBp / 100).toFixed(0)}%`}
            hint={t('score.factors.emptyRatioHint')}
            tone={emptyBp < 2500 ? 'success' : emptyBp < 4000 ? 'warning' : 'destructive'}
          />
          <FactorTile
            label={t('score.factors.onlineVariance')}
            value={`${Math.round(onlineMin / 60)}h ${onlineMin % 60}m`}
            hint={t('score.factors.onlineVarianceHint')}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function FactorTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'success' | 'warning' | 'destructive';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'destructive'
          ? 'text-destructive'
          : 'text-foreground';
  return (
    <div className="rounded-lg border border-border/60 bg-card/50 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('num-tabular mt-1 text-lg font-bold', toneClass)}>{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}

/* -------- Wellness check card ------------------------------------------ */

function WellnessCheckCard({
  checkIn,
  setCheckIn,
  fatigue,
  fatigueRaw,
}: {
  checkIn: CheckIn;
  setCheckIn: (c: CheckIn) => void;
  fatigue: 'low' | 'moderate' | 'high';
  fatigueRaw: number;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    const saved = loadCheckIn(checkIn.date);
    if (saved) setCheckIn(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn.date]);

  const set = <K extends keyof CheckIn>(k: K) => (v: CheckIn[K]) => {
    const next = { ...checkIn, [k]: v };
    setCheckIn(next);
  };

  const setNum = (k: 'sleepHours' | 'continuousMinutes' | 'totalHours' | 'stress' | 'breaks' | 'lastMealHours') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = Number(e.target.value);
      set(k)(Number.isFinite(n) && n >= 0 ? n : 0);
    };

  const handleSave = () => {
    saveCheckIn(checkIn);
    setSavedAt(Date.now());
  };

  const fatigueBadge =
    fatigue === 'high'
      ? 'bg-destructive/15 text-destructive'
      : fatigue === 'moderate'
        ? 'bg-warning/15 text-warning'
        : 'bg-success/15 text-success';

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartHandshake className="h-4 w-4 text-primary" aria-hidden />
            {t('score.checkInTitle')}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{t('score.checkInSubtitle')}</p>
        </div>
        <Badge className={fatigueBadge}>
          {t('score.fatigueLevel')}: {t(`score.fatigue.${fatigue}`)} · {Math.round(fatigueRaw * 100)}%
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="sleepHours">{t('score.fields.sleepHours')}</Label>
            <Input
              id="sleepHours"
              type="number"
              step="0.5"
              min={0}
              max={24}
              dir="ltr"
              value={checkIn.sleepHours}
              onChange={setNum('sleepHours')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="continuousMinutes">{t('score.fields.continuousMinutes')}</Label>
            <Input
              id="continuousMinutes"
              type="number"
              step="5"
              min={0}
              max={720}
              dir="ltr"
              value={checkIn.continuousMinutes}
              onChange={setNum('continuousMinutes')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="totalHours">{t('score.fields.totalHours')}</Label>
            <Input
              id="totalHours"
              type="number"
              step="0.5"
              min={0}
              max={24}
              dir="ltr"
              value={checkIn.totalHours}
              onChange={setNum('totalHours')}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{t('score.fields.feeling')}</Label>
          <div className="grid grid-cols-4 gap-2">
            {(['great', 'ok', 'tired', 'exhausted'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={checkIn.feeling === f}
                onClick={() => set('feeling')(f)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm transition-colors',
                  checkIn.feeling === f
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                    : 'border-border/60 bg-card hover:bg-accent/40',
                )}
              >
                {t(`score.feelings.${f}`)}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((x) => !x)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {expanded ? t('score.lessDetails') : t('score.moreDetails')}
        </button>

        {expanded ? (
          <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="stress">{t('score.fields.stress')}</Label>
                <Input
                  id="stress"
                  type="number"
                  step="1"
                  min={1}
                  max={10}
                  dir="ltr"
                  value={checkIn.stress}
                  onChange={setNum('stress')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="breaks">{t('score.fields.breaks')}</Label>
                <Input
                  id="breaks"
                  type="number"
                  step="1"
                  min={0}
                  max={20}
                  dir="ltr"
                  value={checkIn.breaks}
                  onChange={setNum('breaks')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastMealHours">{t('score.fields.lastMealHours')}</Label>
                <Input
                  id="lastMealHours"
                  type="number"
                  step="0.5"
                  min={0}
                  max={24}
                  dir="ltr"
                  value={checkIn.lastMealHours}
                  onChange={setNum('lastMealHours')}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t('score.fields.hydration')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[true, false].map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      aria-pressed={checkIn.hydration === v}
                      onClick={() => set('hydration')(v)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm transition-colors',
                        checkIn.hydration === v
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                          : 'border-border/60 bg-card hover:bg-accent/40',
                      )}
                    >
                      {t(v ? 'score.yes' : 'score.no')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="weather">{t('score.fields.weather')}</Label>
                <Select
                  id="weather"
                  value={checkIn.weather}
                  onChange={(e) => set('weather')(e.target.value as Weather)}
                >
                  {(['clear', 'rain', 'heat', 'traffic'] as const).map((w) => (
                    <option key={w} value={w}>
                      {t(`score.weatherOptions.${w}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          {savedAt ? (
            <p className="text-xs text-success">{t('score.checkInSaved')}</p>
          ) : (
            <span />
          )}
          <Button onClick={handleSave}>{t('common.save')}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------- Tips card ----------------------------------------------------- */

function TipsCard({
  base,
  adjustedSafety,
  checkIn,
  fatigueRaw,
}: {
  base: { efficiency: number; profit: number; safety: number; consistency: number } | null;
  adjustedSafety: number;
  checkIn: CheckIn;
  fatigueRaw: number;
}) {
  const { t } = useI18n();

  const tips = useMemo<string[]>(() => {
    const out: string[] = [];
    if (!base) return out;
    if (base.efficiency < 50) out.push(t('score.tips.lowEfficiency'));
    if (base.profit < 50) out.push(t('score.tips.lowProfit'));
    if (adjustedSafety < 60) out.push(t('score.tips.lowSafety'));
    if (base.consistency < 50) out.push(t('score.tips.lowConsistency'));
    if (checkIn.sleepHours > 0 && checkIn.sleepHours < 6) out.push(t('score.tips.lowSleep'));
    if (checkIn.continuousMinutes >= 180) out.push(t('score.tips.tooLong'));
    if (!checkIn.hydration && checkIn.totalHours > 3) out.push(t('score.tips.noWaterRest'));
    if (out.length === 0 && fatigueRaw < 0.3) out.push(t('score.tips.good'));
    return out;
  }, [base, adjustedSafety, checkIn, fatigueRaw, t]);

  if (tips.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-primary" aria-hidden /> {t('score.tips.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
