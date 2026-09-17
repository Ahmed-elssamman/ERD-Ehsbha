import { useAuth } from '@/stores/auth.store';
import { z } from 'zod';
import { RecordDraftError, RecordDraftIssue, RecordDraftStatus, recordDraftSchema, type RecordDraft, type RecordDraftKind, type RecordDraftSummary } from './record-draft.model';

const DATABASE = 'ehsbha-record-drafts';
const STORE = 'drafts';
const persistedAccountSchema = z.object({ state: z.object({ user: z.object({ id: z.string() }).nullable() }) });
let accountGeneration = 0;
useAuth.subscribe((state, previous) => { if (state.user?.id !== previous.user?.id) accountGeneration++; });
export function recordDraftAccountGeneration(): number { return accountGeneration; }
export function requireRecordDraftAccount(accountId: string, generation: number) {
  let persistedAccountId: string | null = null;
  try {
    const stored = localStorage.getItem('ehsbha.auth');
    const parsed = persistedAccountSchema.safeParse(stored ? JSON.parse(stored) : null);
    if (parsed.success) persistedAccountId = parsed.data.state.user?.id ?? null;
  } catch { throw new RecordDraftError(RecordDraftIssue.Account); }
  if (useAuth.getState().user?.id !== accountId || persistedAccountId !== accountId || generation !== accountGeneration) {
    throw new RecordDraftError(RecordDraftIssue.Account);
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: ['accountId', 'kind', 'scope'] });
      store.createIndex('account', 'accountId');
    };
    request.onerror = () => reject(new RecordDraftError(RecordDraftIssue.Storage));
    request.onblocked = () => { blocked = true; reject(new RecordDraftError(RecordDraftIssue.Storage)); };
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

function requireAccount(accountId: string, database: IDBDatabase, generation: number) {
  try { requireRecordDraftAccount(accountId, generation); } catch (error) { database.close(); throw error; }
}

export async function readRecordDraft(accountId: string, kind: RecordDraftKind, scope: string): Promise<RecordDraft | null> {
  const generation = accountGeneration;
  const database = await openDatabase();
  requireAccount(accountId, database, generation);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE).get([accountId, kind, scope]);
    transaction.oncomplete = () => {
      database.close();
      if (request.result == null) { resolve(null); return; }
      const parsed = recordDraftSchema.safeParse(request.result);
      if (parsed.success) resolve(parsed.data); else reject(new RecordDraftError(RecordDraftIssue.Invalid));
    };
    transaction.onabort = () => { database.close(); reject(new RecordDraftError(RecordDraftIssue.Storage)); };
    transaction.onerror = transaction.onabort;
  });
}

/** Read and compare in the same write transaction: concurrent tabs cannot both win. */
export async function writeRecordDraft(draft: RecordDraft, expectedRevision: number, generation: number): Promise<RecordDraft> {
  const parsed = recordDraftSchema.safeParse({ ...draft, revision: expectedRevision + 1, updatedAt: Date.now() });
  if (!parsed.success) throw new RecordDraftError(RecordDraftIssue.Invalid);
  const database = await openDatabase();
  requireAccount(draft.accountId, database, generation);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite', { durability: 'strict' });
    const store = transaction.objectStore(STORE);
    const request = store.get([draft.accountId, draft.kind, draft.scope]);
    let issue = RecordDraftIssue.Storage;
    request.onsuccess = () => {
      const current = request.result == null ? null : recordDraftSchema.safeParse(request.result);
      if (current && !current.success) { issue = RecordDraftIssue.Invalid; transaction.abort(); return; }
      const revision = current?.success ? current.data.revision : 0;
      if (revision !== expectedRevision || (current?.success && current.data.generation !== draft.generation)) { issue = RecordDraftIssue.Conflict; transaction.abort(); return; }
      store.put(parsed.data);
    };
    transaction.oncomplete = () => { database.close(); resolve(parsed.data); };
    transaction.onabort = () => { database.close(); reject(new RecordDraftError(issue)); };
    transaction.onerror = transaction.onabort;
  });
}

export async function listRecordDrafts(accountId: string, kind: RecordDraftKind): Promise<RecordDraftSummary[]> {
  const generation = accountGeneration;
  const database = await openDatabase();
  requireAccount(accountId, database, generation);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE).index('account').openCursor(accountId);
    const summaries: RecordDraftSummary[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const key = z.tuple([z.string(), z.string(), z.string()]).safeParse(cursor.primaryKey);
      if (key.success && key.data[1] === kind) {
        const parsed = recordDraftSchema.safeParse(cursor.value);
        if (!parsed.success) summaries.push({ scope: key.data[2], updatedAt: 0, status: null });
        else if (parsed.data.status !== RecordDraftStatus.Completed) summaries.push({ scope: key.data[2], updatedAt: parsed.data.updatedAt, status: parsed.data.status });
      }
      cursor.continue();
    };
    transaction.oncomplete = () => {
      database.close();
      resolve(summaries.sort((a, b) => b.updatedAt - a.updatedAt));
    };
    transaction.onabort = () => { database.close(); reject(new RecordDraftError(RecordDraftIssue.Storage)); };
    transaction.onerror = transaction.onabort;
  });
}

/** Only reset a still-unreadable slot, after explicit confirmation in the editor. */
export async function discardUnreadableRecordDraft(accountId: string, kind: RecordDraftKind, scope: string, validate: (draft: RecordDraft) => void): Promise<void> {
  const generation = accountGeneration;
  const database = await openDatabase();
  requireAccount(accountId, database, generation);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite', { durability: 'strict' });
    const store = transaction.objectStore(STORE), request = store.get([accountId, kind, scope]);
    let issue = RecordDraftIssue.Storage;
    request.onsuccess = () => {
      const parsed = recordDraftSchema.safeParse(request.result);
      let readable = false;
      if (parsed.success) {
        try { validate(parsed.data); readable = true; } catch { readable = false; }
      }
      if (readable || request.result == null) { issue = RecordDraftIssue.Conflict; transaction.abort(); return; }
      const tombstone: RecordDraft = { schemaVersion: 1, generation: crypto.randomUUID(), accountId, kind, scope, revision: 0,
        status: RecordDraftStatus.Completed, context: '', fields: null, linkId: null, pending: null, updatedAt: Date.now() };
      store.put(tombstone);
    };
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onabort = () => { database.close(); reject(new RecordDraftError(issue)); };
    transaction.onerror = transaction.onabort;
  });
}

export async function clearRecordDrafts(accountId: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    const request = transaction.objectStore(STORE).index('account').openKeyCursor(accountId);
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) { transaction.objectStore(STORE).delete(cursor.primaryKey); cursor.continue(); }
    };
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onabort = () => { database.close(); reject(new RecordDraftError(RecordDraftIssue.Storage)); };
    transaction.onerror = transaction.onabort;
  });
}
