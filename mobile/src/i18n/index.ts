import ar from './ar.json';
import en from './en.json';

export type Locale = 'ar' | 'en';
export type Dict = typeof ar;

const dicts: Record<Locale, Dict> = { ar, en: en as Dict };

let currentLocale: Locale = 'ar';

export function setLocale(l: Locale) {
  currentLocale = l;
}

export function getLocale(): Locale {
  return currentLocale;
}

type Path<T> = T extends string ? '' : { [K in keyof T]: K extends string ? `${K}` | `${K}.${Path<T[K]>}` : never }[keyof T];

export function t(key: string, vars?: Record<string, string | number>): string {
  const parts = key.split('.');
  let cur: any = dicts[currentLocale];
  for (const p of parts) {
    if (cur == null) break;
    cur = cur[p];
  }
  let value: string = typeof cur === 'string' ? cur : key;
  if (vars) {
    for (const k of Object.keys(vars)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(vars[k]));
    }
  }
  return value;
}
