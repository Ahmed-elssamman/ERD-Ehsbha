import { generateIdempotencyKey } from '@/features/platform-api';
import { recordDraftAccountGeneration, requireRecordDraftAccount, writeRecordDraft } from './record-draft-store';
import { RecordDraftError, RecordDraftIssue, RecordDraftSaveState, RecordDraftStatus, type RecordDraft, type RecordDraftState } from './record-draft.model';

export class RecordDraftSession {
  initial: RecordDraft;
  private draft: RecordDraft;
  private revision: number;
  private queue: Promise<boolean> = Promise.resolve(true);
  private listeners = new Set<() => void>();
  private state: RecordDraftState;
  private terminalIssue: RecordDraftIssue | null = null;
  private sequence = 0;
  private accountGeneration = recordDraftAccountGeneration();
  constructor(draft: RecordDraft) {
    this.initial = structuredClone(draft);
    this.draft = structuredClone(draft);
    this.revision = draft.revision;
    this.state = { saveState: draft.fields === null ? RecordDraftSaveState.Empty : RecordDraftSaveState.Saved, issue: null, status: draft.status };
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private publish(saveState: RecordDraftSaveState, issue: RecordDraftIssue | null = null) {
    this.state = { saveState, issue, status: this.draft.status };
    this.listeners.forEach((listener) => listener());
  }
  private persist(): Promise<boolean> {
    if (this.terminalIssue) return Promise.resolve(false);
    const sequence = ++this.sequence;
    const snapshot = structuredClone(this.draft);
    this.publish(RecordDraftSaveState.Saving);
    this.queue = this.queue.then(async () => {
      if (this.terminalIssue) return false;
      try {
        const saved = await writeRecordDraft(snapshot, this.revision, this.accountGeneration);
        this.revision = saved.revision;
        if (sequence === this.sequence) this.publish(RecordDraftSaveState.Saved);
        return true;
      } catch (error) {
        const issue = error instanceof RecordDraftError ? error.issue : RecordDraftIssue.Storage;
        if (issue === RecordDraftIssue.Conflict || issue === RecordDraftIssue.Account || issue === RecordDraftIssue.Invalid) this.terminalIssue = issue;
        this.publish(RecordDraftSaveState.Failed, issue);
        return false;
      }
    });
    return this.queue;
  }
  change(fields: string, linkId: string | null) {
    if (this.draft.status !== RecordDraftStatus.Editing) return;
    if (this.draft.fields === fields && this.draft.linkId === linkId) return;
    this.draft = { ...this.draft, fields, linkId };
    void this.persist();
  }
  async flush(): Promise<boolean> {
    const saved = await this.queue;
    return saved || this.persist();
  }
  async prepare(body: string): Promise<{ key: string; body: string }> {
    if (this.draft.status === RecordDraftStatus.Completed) throw new RecordDraftError(RecordDraftIssue.Conflict);
    if (!this.draft.pending) {
      this.draft = { ...this.draft, status: RecordDraftStatus.Pending, pending: { body, key: generateIdempotencyKey(), startedAt: Date.now() } };
      if (!await this.persist()) throw new RecordDraftError(this.state.issue ?? RecordDraftIssue.Storage);
    } else if (!await this.flush()) throw new RecordDraftError(this.state.issue ?? RecordDraftIssue.Storage);
    const pending = this.draft.pending;
    if (!pending) throw new RecordDraftError(RecordDraftIssue.Invalid);
    return pending;
  }
  async rejected(): Promise<void> {
    this.draft = { ...this.draft, status: RecordDraftStatus.Editing, pending: null };
    await this.persist();
  }
  async complete(): Promise<boolean> {
    // Keep a revision tombstone: a stale tab must never recreate a completed draft.
    this.draft = { ...this.draft, status: RecordDraftStatus.Completed, context: '', fields: null, linkId: null, pending: null };
    return this.persist();
  }
  async submit(body: string, send: (pending: { key: string; body: string }) => Promise<void>, unconfirmed: (error: Error) => boolean): Promise<boolean> {
    if (this.draft.status === RecordDraftStatus.Completed) return this.flush();
    const resuming = this.draft.status === RecordDraftStatus.Pending;
    const pending = await this.prepare(body);
    try { requireRecordDraftAccount(this.draft.accountId, this.accountGeneration); } catch {
      this.terminalIssue = RecordDraftIssue.Account;
      this.publish(RecordDraftSaveState.Failed, RecordDraftIssue.Account);
      throw new RecordDraftError(RecordDraftIssue.Account);
    }
    try { await send(pending); } catch (error) {
      if (error instanceof Error && !resuming && !unconfirmed(error)) await this.rejected();
      throw error;
    }
    return this.complete();
  }
}
