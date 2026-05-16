import { create } from 'zustand';

interface ActiveSession {
  id: string;
  driverAppId: string;
  appName: string;
  startedAt: string;
}

interface SessionState {
  activeSession: ActiveSession | null;
  setActiveSession: (s: ActiveSession | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeSession: null,
  setActiveSession: (s) => set({ activeSession: s }),
}));
