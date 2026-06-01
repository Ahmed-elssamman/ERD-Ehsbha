import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'ehsbha.admin.theme';

interface ThemeContextValue {
  theme: Theme;
  resolved: 'light' | 'dark';
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitial(): Theme {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'system';
}

function systemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitial);
  const [resolved, setResolved] = useState<'light' | 'dark'>(() =>
    theme === 'system' ? systemPreference() : theme,
  );

  useEffect(() => {
    const apply = () => {
      const next = theme === 'system' ? systemPreference() : theme;
      setResolved(next);
      const root = document.documentElement;
      root.classList.toggle('dark', next === 'dark');
      root.style.colorScheme = next;
    };
    apply();
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  };

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
