import { recordDraftAccountGeneration, requireRecordDraftAccount } from '@/lib/record-drafts/record-draft-store';
import { freshWellness, normalizeWellness, wellnessSchema, type WellnessState } from './wellness.control';

const DATABASE = 'ehsbha-wellness';
const STORE = 'accounts';
export const WELLNESS_CHANGED = 'ehsbha-wellness-changed';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'accountId' });
    request.onerror = () => reject(new Error('WELLNESS_STORAGE'));
    request.onblocked = () => { blocked = true; reject(new Error('WELLNESS_STORAGE')); };
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

/** Serialize read/modify/write across tabs; never confirm a change before its transaction commits. */
export async function changeWellness(accountId: string, change: (state: WellnessState) => WellnessState): Promise<WellnessState> {
  const generation = recordDraftAccountGeneration();
  requireRecordDraftAccount(accountId, generation);
  const database = await openDatabase();
  try { requireRecordDraftAccount(accountId, generation); } catch (error) { database.close(); throw error; }
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite', { durability: 'strict' });
    const store = transaction.objectStore(STORE);
    const request = store.get(accountId);
    let next: WellnessState | null = null;
    request.onsuccess = () => {
      try {
        requireRecordDraftAccount(accountId, generation);
        const current = request.result == null ? freshWellness(accountId) : wellnessSchema.parse(request.result);
        const updated = change(normalizeWellness(current, Date.now()));
        next = wellnessSchema.parse({ ...updated, accountId, generation: updated.generation, revision: current.revision + 1 });
        store.put(next);
      } catch { transaction.abort(); }
    };
    transaction.oncomplete = () => {
      database.close();
      try { requireRecordDraftAccount(accountId, generation); } catch (error) { reject(error); return; }
      if (next === null) { reject(new Error('WELLNESS_STORAGE')); return; }
      window.dispatchEvent(new Event(WELLNESS_CHANGED));
      resolve(next);
    };
    transaction.onabort = () => { database.close(); reject(new Error('WELLNESS_STORAGE')); };
    transaction.onerror = transaction.onabort;
  });
}

export async function readWellness(accountId: string): Promise<WellnessState> {
  const generation = recordDraftAccountGeneration();
  const database = await openDatabase();
  try { requireRecordDraftAccount(accountId, generation); } catch (error) { database.close(); throw error; }
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    const request = transaction.objectStore(STORE).get(accountId);
    let state: WellnessState | null = null;
    request.onsuccess = () => {
      try {
        requireRecordDraftAccount(accountId, generation);
        const current = request.result == null ? freshWellness(accountId) : wellnessSchema.parse(request.result);
        state = normalizeWellness(current, Date.now());
        if (request.result != null && JSON.stringify(state) !== JSON.stringify(current)) transaction.objectStore(STORE).put(state);
      } catch { transaction.abort(); }
    };
    transaction.oncomplete = () => {
      database.close();
      try {
        requireRecordDraftAccount(accountId, generation);
        if (state === null) throw new Error('WELLNESS_STORAGE');
        resolve(state);
      } catch { reject(new Error('WELLNESS_STORAGE')); }
    };
    transaction.onabort = () => { database.close(); reject(new Error('WELLNESS_STORAGE')); };
    transaction.onerror = transaction.onabort;
  });
}

/** Called on account exit and explicit reset. An opaque generation prevents an old alert acting on a reset. */
export async function clearWellness(accountId: string, requireActiveAccount = false): Promise<void> {
  const generation = recordDraftAccountGeneration();
  const database = await openDatabase();
  if (requireActiveAccount) {
    try { requireRecordDraftAccount(accountId, generation); } catch (error) { database.close(); throw error; }
  }
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite', { durability: 'strict' });
    transaction.objectStore(STORE).put(freshWellness(accountId));
    transaction.oncomplete = () => { database.close(); window.dispatchEvent(new Event(WELLNESS_CHANGED)); resolve(); };
    transaction.onabort = () => { database.close(); reject(new Error('WELLNESS_STORAGE')); };
    transaction.onerror = transaction.onabort;
  });
}
