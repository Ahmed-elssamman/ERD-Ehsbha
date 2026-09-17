import { localDateTimeInstants, resolveLocalDateTime, LocalTimeOccurrence } from '@ehsbha/shared-types';
import { useI18n } from '@/i18n';
import { LOCAL_TIME_CHOICES, parseLocalTimeChoice } from './local-time-choice.control';

interface Props {
  value: string; choice: LocalTimeOccurrence; label: string;
  onChange: (choice: LocalTimeOccurrence) => void; original?: string | null; disabled?: boolean;
}

export function LocalTimeChoice({ value, choice, label, onChange, original = null, disabled = false }: Props) {
  const { t } = useI18n();
  if (localDateTimeInstants(value).length < 2) return null;
  const recorded = resolveLocalDateTime(value, LocalTimeOccurrence.Unspecified, original);
  return <div className="space-y-1">
    <p className="text-sm text-muted-foreground">{t('time.repeated')}</p>
    <select aria-label={`${label}: ${t('time.occurrence')}`} value={choice} disabled={disabled}
      onChange={(event) => onChange(parseLocalTimeChoice(event.target.value))}
      className="min-h-11 w-full rounded-lg border bg-background px-3">
      <option value={LocalTimeOccurrence.Unspecified}>{t(recorded ? 'time.keepRecorded' : 'time.chooseOccurrence')}</option>
      {LOCAL_TIME_CHOICES.map((item) => <option key={item.value} value={item.value}>{t(item.label)}</option>)}
    </select>
  </div>;
}
