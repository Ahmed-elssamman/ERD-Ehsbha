import type { Locale } from '@/i18n';

const NBSP = ' ';

/** piastres → "EGP 12.34" with locale-aware digits */
export function formatMoney(piastres: number, locale: Locale = 'ar'): string {
  const amount = (piastres ?? 0) / 100;
  const nf = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return nf.format(amount).replace(/\s/g, NBSP);
}

/** piastres → "12.34" (no currency) */
export function formatPiastres(piastres: number, locale: Locale = 'ar'): string {
  const amount = (piastres ?? 0) / 100;
  const nf = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return nf.format(amount);
}

/** meters → "12.3" km */
export function formatKm(meters: number, locale: Locale = 'ar', digits = 1): string {
  const km = (meters ?? 0) / 1000;
  const nf = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return nf.format(km);
}

/** integer minutes → "2h 35m" or "35m" */
export function formatDuration(minutes: number, locale: Locale = 'ar'): string {
  const m = Math.max(0, Math.floor(minutes ?? 0));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  const isAr = locale === 'ar';
  const hLabel = isAr ? 'س' : 'h';
  const mLabel = isAr ? 'د' : 'm';
  if (h === 0) return `${rem}${mLabel}`;
  if (rem === 0) return `${h}${hLabel}`;
  return `${h}${hLabel}${NBSP}${rem}${mLabel}`;
}

export function formatNumber(value: number, locale: Locale = 'ar', digits = 0): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value ?? 0);
}

export function formatPercent(bp: number, locale: Locale = 'ar', digits = 0): string {
  const pct = (bp ?? 0) / 10000;
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(pct);
}

export function formatDate(iso: string | Date, locale: Locale = 'ar', opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', opts ?? {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatTime(iso: string | Date, locale: Locale = 'ar'): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
