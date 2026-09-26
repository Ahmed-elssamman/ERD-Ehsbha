import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { dehydrate, hydrate } from '@tanstack/react-query';
import { persistQueryClientRestore } from '@tanstack/react-query-persist-client';
import { createAccountQueryCache } from './account-query-cache';

class MemoryStorage implements Storage {
  values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe('Account query cache isolation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(['1.0.0', '2.0.0'])('discards a pre-work-score cache (%s) before hydration', async (buster) => {
    const storage = new MemoryStorage();
    const old = createAccountQueryCache('driver-a', storage);
    old.client.setQueryData(['analytics', 'hours'], { legacyNet: 5000 });
    await old.persister.persistClient({ timestamp: Date.now(), buster, clientState: dehydrate(old.client) });
    await vi.runAllTimersAsync();
    const reload = createAccountQueryCache('driver-a', storage);
    await persistQueryClientRestore({ queryClient: reload.client, ...reload.persistOptions });
    expect(reload.client.getQueryData(['analytics', 'hours'])).toBeFalsy();
    expect(await reload.persister.restoreClient()).toBeFalsy();
    old.client.clear(); reload.client.clear();
  });

  it('restores financial data only to its owning account', async () => {
    const storage = new MemoryStorage();
    const first = createAccountQueryCache('driver-a', storage);
    first.client.setQueryData(['trips'], [{ id: 'private-trip-a' }]);
    await first.persister.persistClient({ timestamp: Date.now(), buster: '', clientState: dehydrate(first.client) });
    await vi.runAllTimersAsync();

    const second = createAccountQueryCache('driver-b', storage);
    expect(await second.persister.restoreClient()).toBeFalsy();
    expect(second.client.getQueryData(['trips'])).toBeFalsy();
    const reload = createAccountQueryCache('driver-a', storage);
    const persisted = await reload.persister.restoreClient();
    expect(persisted).toBeTruthy();
    if (persisted) hydrate(reload.client, persisted.clientState);
    expect(reload.client.getQueryData(['trips'])).toEqual([{ id: 'private-trip-a' }]);
    first.client.clear(); second.client.clear(); reload.client.clear();
  });

  it('does not persist guest data or restore the legacy shared cache', async () => {
    const storage = new MemoryStorage();
    storage.setItem('ehsbha.rq', '{"private":"legacy"}');
    const guest = createAccountQueryCache(null, storage);
    guest.client.setQueryData(['trips'], ['private']);
    await guest.persister.persistClient({ timestamp: Date.now(), buster: '', clientState: dehydrate(guest.client) });
    await vi.runAllTimersAsync();
    expect(storage.length).toBe(1);
    expect(await guest.persister.restoreClient()).toBeFalsy();
    expect(await createAccountQueryCache('driver-b', storage).persister.restoreClient()).toBeFalsy();
    guest.client.clear();
  });

  it('removes a departing account without deleting another account cache', async () => {
    const storage = new MemoryStorage();
    const first = createAccountQueryCache('driver-a', storage);
    const second = createAccountQueryCache('driver-b', storage);
    for (const cache of [first, second]) {
      await cache.persister.persistClient({ timestamp: Date.now(), buster: '', clientState: dehydrate(cache.client) });
    }
    await vi.runAllTimersAsync();
    await first.persister.removeClient();
    expect(await first.persister.restoreClient()).toBeFalsy();
    expect(await second.persister.restoreClient()).toBeTruthy();
    first.client.clear(); second.client.clear();
  });
});
