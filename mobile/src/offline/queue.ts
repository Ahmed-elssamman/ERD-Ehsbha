import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { api } from '@/api/client';
import { useNetwork } from '@/stores/network.store';

const QUEUE_KEY = 'ehsbha.mutationQueue.v1';

export interface QueuedMutation {
  id: string;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  body: unknown;
  createdAt: number;
  attempts: number;
  lastError?: string;
  status: 'PENDING' | 'IN_FLIGHT' | 'FAILED';
}

async function load(): Promise<QueuedMutation[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedMutation[];
  } catch {
    return [];
  }
}

async function save(items: QueuedMutation[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  useNetwork.getState().setPendingMutations(items.filter((i) => i.status !== 'FAILED').length);
}

export async function enqueue(item: Omit<QueuedMutation, 'id' | 'createdAt' | 'attempts' | 'status'> & { id?: string }) {
  const items = await load();
  const m: QueuedMutation = {
    id: item.id ?? uuidv4(),
    endpoint: item.endpoint,
    method: item.method,
    body: item.body,
    createdAt: Date.now(),
    attempts: 0,
    status: 'PENDING',
  };
  items.push(m);
  await save(items);
  return m;
}

export async function listQueue(): Promise<QueuedMutation[]> {
  return load();
}

export async function flushQueue(): Promise<{ applied: number; failed: number }> {
  let items = await load();
  let applied = 0;
  let failed = 0;
  for (const item of items) {
    if (item.status === 'IN_FLIGHT') continue;
    item.status = 'IN_FLIGHT';
    item.attempts += 1;
    try {
      const config: any = { url: item.endpoint, method: item.method };
      if (item.method !== 'DELETE') config.data = item.body;
      await api.request(config);
      applied++;
      items = items.filter((x) => x.id !== item.id);
    } catch (err: any) {
      failed++;
      item.status = item.attempts >= 6 ? 'FAILED' : 'PENDING';
      item.lastError = err?.message ?? 'unknown';
    }
    await save(items);
  }
  return { applied, failed };
}

export async function clearFailed() {
  const items = (await load()).filter((i) => i.status !== 'FAILED');
  await save(items);
}
