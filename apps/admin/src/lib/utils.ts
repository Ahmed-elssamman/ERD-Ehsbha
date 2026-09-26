import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DRIVER_TIME_ZONE } from '@ehsbha/shared-types';
import type { Locale } from '@/i18n/dict';

export function formatBusinessTimestamp(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    timeZone: DRIVER_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value));
}

export function formatBusinessDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    timeZone: DRIVER_TIME_ZONE, dateStyle: 'medium',
  }).format(new Date(value));
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPiastres(piastres: number | null): string {
  if (piastres === null) return '—';
  const egp = piastres / 100;
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 2,
  }).format(egp);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}
