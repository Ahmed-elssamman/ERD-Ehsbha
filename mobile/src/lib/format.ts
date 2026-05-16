export function piastresToEgp(p: number): number {
  return Math.round(p) / 100;
}

export function formatMoney(piastres: number, locale: 'ar' | 'en' = 'ar'): string {
  const egp = piastresToEgp(piastres);
  const sign = egp < 0 ? '-' : '';
  const abs = Math.abs(egp);
  const str = abs.toLocaleString(locale === 'ar' ? 'en-EG' : 'en-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: abs < 100 ? 2 : 0,
  });
  return locale === 'ar' ? `${sign}${str} ج.م` : `${sign}EGP ${str}`;
}

export function formatMoneyCompact(piastres: number, locale: 'ar' | 'en' = 'ar'): string {
  const egp = piastresToEgp(piastres);
  const abs = Math.abs(egp);
  const sign = egp < 0 ? '-' : '';
  let v: string;
  if (abs >= 1_000_000) v = `${(abs / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) v = `${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  else v = abs.toFixed(0);
  return locale === 'ar' ? `${sign}${v} ج.م` : `${sign}EGP ${v}`;
}

export function formatKm(meters: number): string {
  const km = meters / 1000;
  if (km >= 100) return `${km.toFixed(0)} كم`;
  return `${km.toFixed(1)} كم`;
}

export function formatKmEn(meters: number): string {
  const km = meters / 1000;
  if (km >= 100) return `${km.toFixed(0)} km`;
  return `${km.toFixed(1)} km`;
}

export function formatHours(minutes: number, locale: 'ar' | 'en' = 'ar'): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (locale === 'ar') return h > 0 ? `${h} س ${m > 0 ? m + ' د' : ''}`.trim() : `${m} د`;
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`;
}

export function formatPercent(bp: number, locale: 'ar' | 'en' = 'ar'): string {
  const v = Math.round(bp / 100);
  return locale === 'ar' ? `${v}٪` : `${v}%`;
}

export function formatDate(d: Date | string, locale: 'ar' | 'en' = 'ar'): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (locale === 'ar') {
    return date.toLocaleDateString('ar-EG-u-nu-latn', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTime(d: Date | string, locale: 'ar' | 'en' = 'ar'): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString(locale === 'ar' ? 'en-EG' : 'en-EG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
