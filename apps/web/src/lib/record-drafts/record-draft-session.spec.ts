import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordDraftError, RecordDraftIssue, RecordDraftKind, RecordDraftSaveState, RecordDraftStatus, type RecordDraft } from './record-draft.model';
import { RecordDraftSession } from './record-draft-session';
import { writeRecordDraft } from './record-draft-store';

vi.mock('./record-draft-store', () => ({ writeRecordDraft: vi.fn(), recordDraftAccountGeneration: () => 1, requireRecordDraftAccount: vi.fn() }));
const write = vi.mocked(writeRecordDraft);
function draft(): RecordDraft {
  return { schemaVersion: 1, generation: '11111111-1111-4111-8111-111111111111', accountId: 'account', kind: RecordDraftKind.Fuel, scope: 'new:vehicle', revision: 0,
    status: RecordDraftStatus.Editing, context: '{}', fields: null, linkId: null, pending: null, updatedAt: 1 };
}
beforeEach(() => {
  write.mockReset();
  write.mockImplementation(async (value, revision) => ({ ...value, revision: revision + 1 }));
});
describe('financial draft sessions', () => {
  it('does not send a financial request before its pending identity commits', async () => {
    write.mockRejectedValue(new RecordDraftError(RecordDraftIssue.Storage));
    const session = new RecordDraftSession(draft()), send = vi.fn();
    await expect(session.submit('{"amount":10}', send, () => true)).rejects.toThrow(RecordDraftError);
    expect(send).not.toHaveBeenCalled();
    expect(session.getSnapshot()).toMatchObject({ saveState: RecordDraftSaveState.Failed, status: RecordDraftStatus.Pending });
    const pending = write.mock.calls[0][0].pending;
    write.mockImplementation(async (value, revision) => ({ ...value, revision: revision + 1 }));
    await session.submit('{"amount":999}', send, () => true);
    expect(send).toHaveBeenCalledWith(pending);
  });
  it('replays the stored body and identity after reload without accepting changed input', async () => {
    const original = new RecordDraftSession(draft());
    await expect(original.submit('{"amount":10}', async () => { throw new Error('lost-response'); }, () => true)).rejects.toThrow('lost-response');
    const stored = write.mock.calls[0][0], send = vi.fn();
    const resumed = new RecordDraftSession({ ...stored, revision: 1 });
    await resumed.submit('{"amount":999}', send, () => true);
    expect(send).toHaveBeenCalledWith(stored.pending);
    expect(resumed.getSnapshot().status).toBe(RecordDraftStatus.Completed);
  });
  it('keeps an uncertain save frozen even when a later retry receives a conflict', async () => {
    const original = new RecordDraftSession(draft());
    await expect(original.submit('{}', async () => { throw new Error('lost'); }, () => true)).rejects.toThrow();
    await expect(original.submit('{}', async () => { throw new Error('version-conflict'); }, () => false)).rejects.toThrow();
    expect(original.getSnapshot().status).toBe(RecordDraftStatus.Pending);
  });
  it('unlocks a first attempt that is definitively rejected', async () => {
    const session = new RecordDraftSession(draft());
    await expect(session.submit('{}', async () => { throw new Error('validation'); }, () => false)).rejects.toThrow();
    expect(session.getSnapshot().status).toBe(RecordDraftStatus.Editing);
  });
  it('retries local completion without sending the successful payment again', async () => {
    const session = new RecordDraftSession(draft()), send = vi.fn();
    write.mockImplementation(async (value, revision) => {
      if (value.status === RecordDraftStatus.Completed) throw new RecordDraftError(RecordDraftIssue.Storage);
      return { ...value, revision: revision + 1 };
    });
    expect(await session.submit('{}', send, () => true)).toBe(false);
    write.mockImplementation(async (value, revision) => ({ ...value, revision: revision + 1 }));
    expect(await session.submit('{}', send, () => true)).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(write.mock.calls.at(-1)?.[0]).toMatchObject({ status: RecordDraftStatus.Completed, fields: null, context: '', pending: null });
  });
  it('never retries a write after a competing tab wins', async () => {
    const session = new RecordDraftSession(draft()), send = vi.fn();
    write.mockRejectedValue(new RecordDraftError(RecordDraftIssue.Conflict));
    session.change('{"notes":"local"}', null);
    expect(await session.flush()).toBe(false);
    await expect(session.submit('{}', send, () => true)).rejects.toThrow(RecordDraftError);
    expect(write).toHaveBeenCalledTimes(1); expect(send).not.toHaveBeenCalled();
    expect(session.getSnapshot().issue).toBe(RecordDraftIssue.Conflict);
  });
  it('never announces that newer queued edits are saved after an older commit', async () => {
    const session = new RecordDraftSession(draft());
    let release: (draft: RecordDraft) => void = () => {};
    write.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    session.change('{"notes":"first"}', null);
    await Promise.resolve();
    session.change('{"notes":"second"}', null);
    release({ ...draft(), revision: 1 });
    await Promise.resolve();
    expect(session.getSnapshot().saveState).toBe(RecordDraftSaveState.Saving);
    await session.flush(); expect(session.getSnapshot().saveState).toBe(RecordDraftSaveState.Saved);
    expect(write.mock.calls[1][1]).toBe(1);
  });
});
