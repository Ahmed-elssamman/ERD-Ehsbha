# ADR-0010: Device drafts and recoverable operating-record saves

**Status**: accepted
**Date**: 2026-09-17
**Owner**: Platform team

## Context

Expense, maintenance and fuel editors kept inputs and retry identities only in
mounted components. Closing or reloading could lose work or encourage a second
entry after the first request had committed. Reloaded edits must also retain
their original version rather than silently adopting a newer server version.

## Decision

Use the browser's IndexedDB implementation without another dependency. Store one
create draft per account and feature/vehicle scope, and separate drafts for each
edited record. Persist incomplete form values, the original record/vehicle
context, explicit payment links, and a pending request body and UUID. Validate
both the versioned storage envelope and feature-specific content with Zod. Keep
raw draft validation separate from the stricter submitted financial contracts.

Save form changes in ordered transactions. Show device-save success only after
the latest transaction completes. Before any network mutation, commit its body
and retry identity. Reload/retry uses that identity and body with the captured
record version. There is no automatic upload. A first attempt with a definitive
rejection may be edited; an uncertain attempt stays locked even if a later retry
conflicts, because the earlier attempt may have succeeded.

Compare generation and revision inside a read/write transaction to reject stale
tabs. Successful completion or deliberate discard leaves a small empty
tombstone, preventing an old tab from recreating the draft. If local completion
fails after network success, retry only the local cleanup while the editor
remains mounted; after reload the retained pending request can recover through
server idempotency. Existing create mutation identifiers and edit versions remain
the backend safeguards beyond the HTTP ledger's retention window.

Provide resume lists containing only scope/status/time metadata, independent of
the current server page, vehicle list or month filter. Keep full draft contents
out of the general persisted query cache. A completed draft selected from a
stale list cannot open as a fresh entry. An unreadable slot can be discarded only
after an explicit warning to check account records; the transaction verifies
that the slot remains unreadable and replaces only that slot with a new empty
generation. Other drafts and server records remain intact.

Isolate by account, reject writes from an earlier account generation, and check
the persisted account before writes/network submission to cover logout in another
tab. Logout/account switching removes that account's device drafts. Device
storage failures retain the mounted inputs and block a financial request until
the pending identity can be persisted. This is an intentional integrity tradeoff,
with retry and close/error states rather than a false save confirmation.

## Consequences

This improves ordinary close, navigation, reload and poor-network recovery; it
does not make browser storage a backup. Storage is best-effort and may be evicted
or cleared; private browsing and logout can remove drafts. The UI states these
limits. Pending drafts are not expired automatically: an unknown save outcome
must not become an apparently new entry. Financial content is removed on
completion/discard, and remaining drafts are removed on logout.

Changes to the draft schema or request semantics must provide an explicit
migration or unreadable-draft recovery. A future adapter must not reinterpret an
old pending body or replace its retry identity. This checkpoint covers create
and edit forms for these three operating-record families. It does not close
manual-trip draft/sync requirements or add durable archive/restore dialogs.

## Alternatives

Unversioned localStorage writes cannot atomically compare two writers. A generic
automatic offline upload queue would require broader conflict/reconciliation
semantics and user controls; it is not introduced for these forms. Recomputing
a pending mutation from current server values would discard its original
version and could overwrite a newer financial record.

Browser behavior was checked against MDN on 17 September 2026:

- https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
- https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- https://react-hook-form.com/docs/useform/handlesubmit

The transaction requests strict durability, but device/browser failures and
eviction still preclude a guarantee of permanent storage.

Linked amount inputs use `readOnly`; uncertain saves disable their surrounding
fieldset. React Hook Form documents that individually disabled inputs can lose
their submitted values, whereas these controls preserve them.
