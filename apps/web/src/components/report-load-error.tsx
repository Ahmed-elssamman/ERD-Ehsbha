import { useI18n } from '@/i18n';
import { readApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';

interface ReportLoadErrorProps {
  error: Error;
  retry: () => void;
}

export function ReportLoadError({ error, retry }: ReportLoadErrorProps) {
  const { t } = useI18n();
  const failure = readApiError(error);
  const key = (failure.code === 'REPORTING_CALENDAR_PENDING' || failure.code === 'REPORTING_PROJECTION_PENDING') ? `errors.${failure.code}` : 'time.reportFailed';
  return <div role="alert" className="space-y-3 rounded-xl border border-destructive/40 p-4">
    <p className="text-sm">{t(key)}</p>
    <Button variant="outline" onClick={retry}>{t('common.retry')}</Button>
  </div>;
}
