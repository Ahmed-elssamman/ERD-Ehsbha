import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  phone: string;
  email?: string | null;
  locale: 'ar' | 'en';
  timezone: string;
  driverId: string | null;
  displayName?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  setSession: (s: { user: AuthUser; accessToken: string; refreshToken: string }) => void;
  setAccessToken: (t: string | null) => void;
  setUser: (u: AuthUser | null) => void;
  clear: () => void;
  markHydrated: () => void;
}

/**
 * Refresh + user persist in localStorage so the session survives a reload.
 * Access token stays in memory only — it's short-lived and is refreshed
 * on the next protected request if absent.
 *
 * Note: localStorage is XSS-readable. The backend doesn't issue httpOnly
 * cookies yet; if/when it does, swap this to in-memory only.
 */
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: false,
      setSession: ({ user, accessToken, refreshToken }) => set({ user, accessToken, refreshToken }),
      setAccessToken: (t) => set({ accessToken: t }),
      setUser: (u) => set({ user: u }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'ehsbha.auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ user: s.user, refreshToken: s.refreshToken }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
