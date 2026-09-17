import { useI18n } from '@/i18n/provider';

interface Props { grossPiastres?: number | null; grossKnownTripCount?: number; tripCount?: number }

export function FinancialCoverageNotice({ grossPiastres, grossKnownTripCount, tripCount }: Props) {
  const { t } = useI18n();
  if (grossPiastres !== null) return null;
  const message = grossKnownTripCount != null && tripCount != null
    ? t('finance.partial', { known: grossKnownTripCount, total: tripCount }) : t('finance.partialUnknown');
  return <p role="status" className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">{message}</p>;
}
