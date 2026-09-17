import type { Locale } from '@ehsbha/shared-types';
import type { DigestMessage, DigestSnapshot } from './digest.model';

const DIGEST_COPY = {
  en: {
    title: 'Your work digest', target: 'Today’s remaining-goal target: {amount}.', yesterday: 'Yesterday’s recorded net operating income: {amount}.',
    hour: 'Trips starting around {hour}: {amount} per trip hour, based on {count} trips.',
    app: '{name} has the highest recorded take-home total for this weekday: {amount}.',
    area: 'In {name}, recorded take-home income was {amount} per paid km, below the comparison areas.',
    limits: 'Trip comparisons exclude waiting time and operating expenses. They describe past records, not expected future earnings.',
    unavailable: 'Trip comparisons are unavailable because this period exceeds the supported detail limit.',
  },
  ar: {
    title: 'ملخص شغلك', target: 'المطلوب النهارده من باقي الهدف: {amount}.', yesterday: 'صافي دخل التشغيل المسجّل إمبارح: {amount}.',
    hour: 'الرحلات اللي بدأت حوالي {hour}: {amount} لكل ساعة رحلة، بناءً على {count} رحلات.',
    app: 'أعلى إجمالي دخل مستلم مسجّل لنفس يوم الأسبوع كان على {name}: {amount}.',
    area: 'في {name}، الدخل المستلم المسجّل كان {amount} لكل كم مدفوع، أقل من المناطق المقارنة.',
    limits: 'مقارنات الرحلات مش بتشمل وقت الانتظار ولا مصاريف التشغيل. دي سجلات سابقة، مش توقع للدخل الجاي.',
    unavailable: 'مقارنات الرحلات مش متاحة لأن الفترة دي أكبر من حد التفاصيل المدعوم.',
  },
};
function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}
export function digestMessage(snapshot: DigestSnapshot, locale: Locale): DigestMessage {
  const copy = DIGEST_COPY[locale], value = snapshot.insights, lines: string[] = [];
  const money = (amount: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EGP' }).format(amount / 100);
  if (value.todayTargetPiastres !== null) lines.push(interpolate(copy.target, { amount: money(value.todayTargetPiastres) }));
  if (value.yesterdayNetPiastres !== null) lines.push(interpolate(copy.yesterday, { amount: money(value.yesterdayNetPiastres) }));
  if (value.bestStartHour) lines.push(interpolate(copy.hour, {
    hour: new Intl.DateTimeFormat(locale, { hour: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, value.bestStartHour.hour))),
    amount: money(value.bestStartHour.earningsPerTripHourPiastres), count: new Intl.NumberFormat(locale).format(value.bestStartHour.tripCount),
  }));
  if (value.highestAppTotal) lines.push(interpolate(copy.app, { name: value.highestAppTotal.appName, amount: money(value.highestAppTotal.earningsPiastres) }));
  if (value.lowerAreaRate) lines.push(interpolate(copy.area, { name: value.lowerAreaRate.areaName, amount: money(value.lowerAreaRate.earningsPerPaidKmPiastres) }));
  if (value.bestStartHour || value.highestAppTotal || value.lowerAreaRate) lines.push(copy.limits);
  if (snapshot.sourceTripCount === null) lines.push(copy.unavailable);
  return { title: copy.title, body: lines.join(' ') };
}
