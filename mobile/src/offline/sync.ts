import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { flushQueue } from './queue';
import { useNetwork } from '@/stores/network.store';

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startSync() {
  NetInfo.addEventListener((state) => {
    const online = !!state.isConnected && state.isInternetReachable !== false;
    useNetwork.getState().setOnline(online);
    if (online) void flushQueue();
  });

  AppState.addEventListener('change', (next) => {
    if (next === 'active') void flushQueue();
  });

  if (!intervalId) {
    intervalId = setInterval(() => {
      if (useNetwork.getState().online) void flushQueue();
    }, 30_000);
  }
}
