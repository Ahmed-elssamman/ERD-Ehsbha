import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const REFRESH_KEY = 'ehsbha.refreshToken';

export interface AuthUser {
  id: string;
  phone: string;
  locale: 'ar' | 'en';
  timezone: string;
  driverId: string | null;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  setSession: (s: { user: AuthUser; accessToken: string; refreshToken: string }) => Promise<void>;
  setAccessToken: (t: string) => void;
  clear: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,

  async setSession({ user, accessToken, refreshToken }) {
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
    set({ user, accessToken, refreshToken });
  },

  setAccessToken(t) {
    set({ accessToken: t });
  },

  async clear() {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    set({ user: null, accessToken: null, refreshToken: null });
  },

  async hydrate() {
    try {
      const r = await SecureStore.getItemAsync(REFRESH_KEY);
      set({ refreshToken: r, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));
