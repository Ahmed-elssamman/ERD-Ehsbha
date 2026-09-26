import { useI18n } from '@/i18n';

interface Props { grossPiastres?: number | null; grossKnownTripCount?: number; tripCount?: number }

export function FinancialCoverageNotice({ grossPiastres, grossKnownTripCount, tripCount }: Props) {
  const { t } = useI18n();
  if (grossPiastres !== null) return null;
  const message = grossKnownTripCount != null && tripCount != null
    ? t('trips.finance.partial', { known: grossKnownTripCount, total: tripCount }) : t('trips.finance.partialUnknown');
  return <p role="status" className="col-span-full rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">{message}</p>;
}
