import { useQuery } from '@tanstack/react-query';
import { Gauge } from 'lucide-react';
import { motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useI18n } from '@/i18n';
import { ScoreApi } from '@/lib/api/endpoints';
import { formatDate, formatNumber } from '@/lib/format';

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

export function DriverScorePage() {
  const { t, locale } = useI18n();
  const todayQ = useQuery({ queryKey: ['score', 'today'], queryFn: ScoreApi.today });
  const histQ = useQuery({ queryKey: ['score', 'history'], queryFn: () => ScoreApi.history() });

  const data = todayQ.data;
  const overall = data?.overall ?? 0;
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
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-4 w-4 text-primary" aria-hidden />
              {t('score.overall')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayQ.isLoading ? (
              <div className="grid place-items-center"><Skeleton className="h-40 w-40 rounded-full" /></div>
            ) : !data ? (
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
                  {(['efficiency', 'profit', 'safety', 'consistency'] as const).map((k) => (
                    <div key={k} className="rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t(`score.${k}`)}</p>
                      <p className="num-tabular mt-0.5 text-base font-semibold">{formatNumber(data[k] ?? 0, locale)}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

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
                    <Area
                      type="monotone"
                      dataKey="overall"
                      stroke="hsl(var(--primary))"
                      fill="url(#scoreFill)"
                      strokeWidth={2.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
