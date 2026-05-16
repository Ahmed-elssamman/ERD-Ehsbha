import { create } from 'zustand';

interface NetworkState {
  online: boolean;
  pendingMutations: number;
  setOnline: (v: boolean) => void;
  setPendingMutations: (n: number) => void;
}

export const useNetwork = create<NetworkState>((set) => ({
  online: true,
  pendingMutations: 0,
  setOnline: (online) => set({ online }),
  setPendingMutations: (pendingMutations) => set({ pendingMutations }),
}));
