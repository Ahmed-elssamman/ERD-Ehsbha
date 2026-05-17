import { Link } from 'react-router-dom';
import { Gauge, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n';
import type { DriverScore } from '@/lib/api/endpoints';
import { formatNumber } from '@/lib/format';

const SIZE = 132;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

function scoreColor(score: number): string {
  if (score >= 80) return 'hsl(var(--success))';
  if (score >= 60) return 'hsl(var(--primary))';
  if (score >= 40) return 'hsl(var(--warning))';
  return 'hsl(var(--destructive))';
}

interface Props {
  data: DriverScore | null | undefined;
  loading: boolean;
}

export function ScoreCard({ data, loading }: Props) {
  const { t, locale } = useI18n();
  const overall = data?.overall ?? 0;
  const dashOffset = CIRC - (CIRC * overall) / 100;
  const color = scoreColor(overall);

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      <Link to="/driver-score" aria-label={t('dashboard.viewDetails')} className="group block">
        <Card className="transition-all hover:border-primary/40 hover:shadow-elevated">
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-4 w-4 text-primary" aria-hidden />
              {t('dashboard.score')}
            </CardTitle>
            <ArrowRight
              className="h-4 w-4 text-muted-foreground/60 transition-all group-hover:translate-x-0.5 group-hover:text-primary rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
              aria-hidden
            />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid place-items-center py-2">
                <Skeleton className="h-32 w-32 rounded-full" />
              </div>
            ) : !data ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('dashboard.scoreEmpty')}</p>
            ) : (
              <div className="grid place-items-center gap-3">
                <div className="relative" style={{ width: SIZE, height: SIZE }}>
                  <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
                    <circle
                      cx={SIZE / 2}
                      cy={SIZE / 2}
                      r={RADIUS}
                      fill="none"
                      stroke="hsl(var(--muted))"
                      strokeWidth={STROKE}
                    />
                    <motion.circle
                      cx={SIZE / 2}
                      cy={SIZE / 2}
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
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="text-center">
                      <p
                        className="num-tabular text-3xl font-bold leading-none"
                        style={{ color }}
                      >
                        {formatNumber(overall, locale)}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">/ 100</p>
                    </div>
                  </div>
                </div>
                <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
                  {(['efficiency', 'profit', 'safety', 'consistency'] as const).map((k) => (
                    <div
                      key={k}
                      className="rounded-md border border-border/60 bg-card/50 px-2 py-1.5 text-center"
                    >
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t(`score.${k}`)}
                      </p>
                      <p
                        className="num-tabular text-sm font-semibold"
                        style={{ color: scoreColor(data[k] ?? 0) }}
                      >
                        {formatNumber(data[k] ?? 0, locale)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
