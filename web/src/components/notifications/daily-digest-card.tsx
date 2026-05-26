import { Target, Clock, MapPin, Sparkles, Compass, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n';
import { formatMoney } from '@/lib/format';
import type { DailyDigestData } from '@/lib/api/endpoints';

interface Props {
  data: DailyDigestData;
}

/**
 * Visual renderer for the morning DAILY_DIGEST notification. Unlike a plain
 * text notification, the digest carries structured insights — we surface
 * the target as a hero number, then list each tip with its own icon so the
 * driver scans it in one glance.
 *
 * Designed for the notifications inbox row; the parent supplies the
 * timestamp, read/unread chrome, and mark-as-read button.
 */
export function DailyDigestCard({ data }: Props) {
  const { t, locale } = useI18n();
  const { insights, tips } = data;
  const targetEgp = insights.todayTargetPiastres ?? null;

  return (
    <div className="space-y-3">
      {targetEgp != null ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-3 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-3"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <Target className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              {t('notifications.digest.todayTargetLabel')}
            </p>
            <p className="num-tabular text-lg font-bold text-primary">
              {formatMoney(targetEgp, locale)}
            </p>
            {insights.monthlyGoalPiastres != null ? (
              <p className="text-[11px] text-muted-foreground">
                {t('notifications.digest.monthlyContext', {
                  earned: Math.round(insights.earnedThisMonthPiastres / 100),
                  goal: Math.round(insights.monthlyGoalPiastres / 100),
                  days: insights.remainingDaysInMonth,
                })}
              </p>
            ) : null}
          </div>
        </motion.div>
      ) : null}

      {tips.length > 0 ? (
        <ul className="space-y-2">
          {tips
            .filter((tip) => tip.key !== 'tip.todayTarget')
            .map((tip, i) => (
              <motion.li
                key={`${tip.key}-${i}`}
                initial={{ opacity: 0, x: locale === 'ar' ? 8 : -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18, delay: i * 0.04 }}
                className="flex items-start gap-2.5 rounded-lg border bg-background p-2.5"
              >
                <TipIcon kind={tip.key} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">{renderTip(t, tip, insights, locale)}</p>
                </div>
              </motion.li>
            ))}
        </ul>
      ) : null}

      {/* Yesterday's snapshot — a small footer chip when there's data. */}
      {insights.yesterdayNetPiastres !== 0 ? (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
          <Badge variant="muted" className="gap-1">
            <RotateCcw className="h-3 w-3" aria-hidden />
            {t('notifications.digest.yesterdayNet', {
              egp: Math.round(insights.yesterdayNetPiastres / 100),
            })}
          </Badge>
        </div>
      ) : null}
    </div>
  );
}

function TipIcon({ kind }: { kind: string }) {
  // Each tip key gets a distinct icon so the inbox feels organised. Falls
  // back to the sparkle for unknown tips so a future server-side tip kind
  // still renders gracefully.
  const className = 'mt-0.5 h-4 w-4 shrink-0 text-primary';
  switch (kind) {
    case 'tip.bestHour':
      return <Clock className={className} aria-hidden />;
    case 'tip.bestApp':
      return <Compass className={className} aria-hidden />;
    case 'tip.avoidArea':
      return <MapPin className={className} aria-hidden />;
    case 'tip.emptyKm':
      return <RotateCcw className={className} aria-hidden />;
    default:
      return <Sparkles className={className} aria-hidden />;
  }
}

function renderTip(
  t: (key: string, vars?: Record<string, string | number>) => string,
  tip: { key: string; vars: Record<string, string | number> },
  insights: DailyDigestData['insights'],
  _locale: 'ar' | 'en',
): string {
  // The backend already serialises a localised string into the notification
  // body, but the structured tips array lets us re-render in the user's
  // currently selected locale even if the digest was created in another.
  // For unknown keys, the raw key is returned (visible in dev as a hint).
  void insights;
  return t(`notifications.digest.${tip.key.replace(/^tip\./, 'tip.')}`, tip.vars);
}
