import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AdminSession {
  accessToken: string;
  refreshToken: string;
  admin: {
    id: string;
    email: string;
    displayName: string;
    roles: string[];
    permissions: string[];
  };
}

interface AdminAuthState {
  session: AdminSession | null;
  setSession: (s: AdminSession) => void;
  clearSession: () => void;
  hasPermission: (perm: string) => boolean;
  hasAnyPermission: (perms: string[]) => boolean;
}

export const useAdminAuth = create<AdminAuthState>()(
  persist(
    (set, get) => ({
      session: null,
      setSession: (s) => set({ session: s }),
      clearSession: () => set({ session: null }),
      hasPermission: (perm) => {
        const s = get().session;
        if (!s) return false;
        return s.admin.permissions.includes(perm) || s.admin.permissions.includes('*');
      },
      hasAnyPermission: (perms) => {
        const s = get().session;
        if (!s) return false;
        if (s.admin.permissions.includes('*')) return true;
        return perms.some((p) => s.admin.permissions.includes(p));
      },
    }),
    {
      name: 'ehsbha.admin.auth',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
