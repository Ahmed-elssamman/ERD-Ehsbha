export type Locale = 'ar' | 'en'

const LOCALE_VALUES: Locale[] = ['ar', 'en']

export function isLocale(value: unknown): value is Locale {
  return value === 'ar' || value === 'en'
}

export function parseLocale(value: string): Locale {
  if (value === 'ar') return 'ar'
  if (value === 'en') return 'en'
  throw new Error(`Invalid locale: "${value}". Must be "ar" or "en"`)
}

export function getLocales(): Locale[] {
  return LOCALE_VALUES
}
