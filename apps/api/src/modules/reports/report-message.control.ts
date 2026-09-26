import { ReportPeriod } from '@ehsbha/shared-types';

const REPORT_MESSAGES = {
  ar: { weekly: 'تقرير الأسبوع جاهز', monthly: 'تقرير الشهر جاهز', body: 'راجع دخلك وتكاليفك المسجلة للفترة {start} إلى {end}.' },
  en: { weekly: 'Your weekly report is ready', monthly: 'Your monthly report is ready', body: 'Review your recorded income and costs from {start} to {end}.' },
};
export function reportMessage(period: ReportPeriod, startsOn: string, endsOn: string, locale: string): { title: string; body: string } {
  const copy = locale === 'ar' ? REPORT_MESSAGES.ar : REPORT_MESSAGES.en;
  return { title: period === ReportPeriod.Weekly ? copy.weekly : copy.monthly, body: copy.body.replace('{start}', startsOn).replace('{end}', endsOn) };
}
