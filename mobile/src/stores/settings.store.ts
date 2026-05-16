import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Locale, setLocale } from '@/i18n';

const KEY = 'ehsbha.settings.v1';

interface SettingsState {
  locale: Locale;
  hydrated: boolean;
  setLocale: (l: Locale) => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  locale: 'ar',
  hydrated: false,

  async setLocale(l) {
    set({ locale: l });
    setLocale(l);
    await AsyncStorage.setItem(KEY, JSON.stringify({ locale: l }));
  },

  async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw) as { locale: Locale };
        set({ locale: data.locale, hydrated: true });
        setLocale(data.locale);
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },
}));
