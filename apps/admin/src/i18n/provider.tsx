import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DICT, type Locale } from './dict';

const STORAGE_KEY = 'ehsbha.admin.locale';

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (path: string, vars?: Record<string, string | number>) => string;
  dir: 'ltr' | 'rtl';
}

const Ctx = createContext<I18nContextValue | null>(null);

function readKey(path: string): { en: string; ar: string } | null {
  const parts = path.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = DICT;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object' || !(p in cur)) return null;
    cur = cur[p];
  }
  if (cur && typeof cur === 'object' && 'en' in cur && 'ar' in cur) {
    return cur as { en: string; ar: string };
  }
  return null;
}

function getInitial(): Locale {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
  return stored === 'ar' || stored === 'en' ? stored : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitial);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const dir: 'ltr' | 'rtl' = locale === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = dir;
  }, [locale, dir]);

  const t = useCallback(
    (path: string, vars?: Record<string, string | number>) => {
      const entry = readKey(path);
      if (!entry) {
        if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${path}`);
        return path;
      }
      let out = entry[locale];
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          out = out.replace(`{${k}}`, String(v));
        }
      }
      return out;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t, dir }), [locale, setLocale, t, dir]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used within I18nProvider');
  return v;
}
