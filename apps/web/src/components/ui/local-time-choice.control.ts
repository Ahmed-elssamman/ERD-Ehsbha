import { LocalTimeOccurrence } from '@ehsbha/shared-types';

export const LOCAL_TIME_CHOICES = [
  { value: LocalTimeOccurrence.Earlier, label: 'time.beforeClockChange' },
  { value: LocalTimeOccurrence.Later, label: 'time.afterClockChange' },
];

export function parseLocalTimeChoice(value: string): LocalTimeOccurrence {
  return LOCAL_TIME_CHOICES.find((choice) => choice.value === value)?.value ?? LocalTimeOccurrence.Unspecified;
}
