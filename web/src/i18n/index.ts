import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import ar from './ar.json';
import en from './en.json';

export type Locale = 'ar' | 'en';
export type Dict = typeof ar;

const STORAGE_KEY = 'ehsbha.locale';
const dicts: Record<Locale, Dict> = { ar, en: en as Dict };

function resolveInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'ar';
  const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored === 'ar' || stored === 'en') return stored;
  const navLocale = navigator.language?.slice(0, 2).toLowerCase();
  return navLocale === 'en' ? 'en' : 'ar';
}

function applyDocumentDir(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('lang', locale);
  document.documentElement.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
}

function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const parts = key.split('.');
  let cur: unknown = dicts[locale];
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') break;
    cur = (cur as Record<string, unknown>)[p];
  }
  let value: string = typeof cur === 'string' ? cur : key;
  if (vars) {
    for (const k of Object.keys(vars)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(vars[k]));
    }
  }
  return value;
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  dir: 'rtl' | 'ltr';
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>(resolveInitialLocale);

  useEffect(() => {
    applyDocumentDir(locale);
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // ignore quota / private mode
    }
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    const dir: 'rtl' | 'ltr' = locale === 'ar' ? 'rtl' : 'ltr';
    return {
      locale,
      dir,
      setLocale: setLocaleState,
      toggleLocale: () => setLocaleState((cur) => (cur === 'ar' ? 'en' : 'ar')),
      t: (key, vars) => translate(locale, key, vars),
    };
  }, [locale]);

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export function useT() {
  return useI18n().t;
}
