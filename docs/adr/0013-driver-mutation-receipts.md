# ADR-0013: Atomic acknowledgements for sync mutations and session endings

**Status**: accepted
**Date**: 2026-09-17
**Owner**: Platform team

## Context

Sync push used untyped payload/result maps, logged raw exception messages, and
classified almost every failure as invalid input. Session end discarded the
mutation identity and rejected all replays after a successful end. Creation
deduplication compared requests against mutable records, so a later correction
could also make an already-applied sync request look like a conflict.

Writing a separate acknowledgement after the domain transaction would leave a
crash window: the financial change could commit while its receipt did not.

## Decision

Add `driver_mutation_receipts`, keyed by authenticated driver and client mutation
ID. It stores only the canonical request hash, affected record ID, and an instant
recorded as `TIMESTAMPTZ(3)`. The hash includes the mutation kind and the validated
payload, using the existing canonical JSON function. Object key order and date
string offsets normalize through shared schemas and canonical serialization.
Changes to kind or normalized payload under an acknowledged identity conflict.

The existing driver row lock serializes mutations. For each sync item, one
transaction checks the receipt, runs the normal domain logic, updates financial
history/projections/mileage, and inserts the receipt. Existing transaction-aware
trip creation is reused; fuel/expense creation and session start/end now expose
equivalent internal methods. Their ordinary service entry points still own their
transactions. Keep the existing 15-second financial transaction timeout.

A receipt acknowledges an operation, not a frozen copy of its record. An applied
sync result contains `kind`, `clientMutationId`, `recordId`, `appliedAt`, `replayed`
and typed `data`. Replay returns the current owner-scoped record, including its
corrections or soft-deletion state. If the record was hard-deleted, `data` is null
and the applied receipt remains authoritative. The caller must not recreate it.
No notes, locations, image data or financial payload snapshots enter this ledger.

The ordinary `POST /sessions/:id/end` body now requires `clientMutationId` in
addition to optional `endedAt`. It uses the same hash/receipt transaction as sync
session end. Retrying the same command is safe, including when the initial end
time was chosen by the server. Another key for an already-ended session conflicts;
the same key with another end time or session ID also conflicts. Existing starts
continue to use their creation identity; every new action needs a new identity.

Shared discriminated schemas describe all five mutation payloads and applied
record types. There is one outer mutation identity; nested identities and
client-controlled trip origin are rejected. The entire request is structurally
validated before execution (1–50 items with distinct identities). Invalid shape
or scalar constraints reject the request with no writes. Valid requests execute
in order with an independent transaction per item; domain validation, missing
references, conflicts and internal failures produce partial results and do not
prevent subsequent valid items from executing.

Failure results carry a governed code and localization key, never raw exception
messages. Status distinguishes validation, conflict, missing records, forbidden
actions, retryable infrastructure failures and internal failures. Known database
transaction contention/timeout can be retried with the same identity. Logs retain
only the operation kind and governed code. New session state errors have Arabic
and English messages.

Request schema validation happens before item execution. A schema failure inside
an executing item therefore indicates a produced-record contract violation, not
invalid driver input. It returns the governed internal contract classification
without exposing the schema's stored values, and rolls back that transaction.

## Alternatives

- Reuse the ordinary HTTP idempotency interceptor alone: its acknowledgement
  occurs after the domain transaction and expires after 24 hours. It cannot by
  itself establish the required durable sync guarantee.
- Treat every already-ended session as success: hides a different requested end
  time or a different command. Identity plus request hash makes this explicit.
- Save complete historical responses: duplicates sensitive payloads and can send
  stale record contents after a correction. The receipt plus current state is
  enough to acknowledge the command.
- Wrap the entire batch in one transaction: would discard valid independent work
  when one item fails and hold the driver lock for the full batch.

## Consequences

Receipts remain until account deletion, which cascades through the driver FK.
There is no scheduled expiry that could allow an old device command to recreate
a hard-deleted record. Storage grows by small metadata rows per acknowledged
command. A future retention change needs an explicit expired-identity protocol;
silently pruning rows is unsafe.

This guarantee applies to commands acknowledged by the new ledger. Existing
records with creation identities can be adopted through their existing duplicate
checks when first sent to the new sync endpoint. Original requests for records
already hard-deleted before this migration cannot be reconstructed; no invented
historical hashes or acknowledgements are backfilled.

The unpublished coordinated contract-2 release already includes incompatible
sync push. Session end joins that manifest because its identity is now required.
Update consumers together; no driver-browser sync or session transport consumer
was found in the inspected worktree. Existing device drafts remain independent.
Batch work is bounded by item count but its total latency grows with its work;
the measured single-item budget is not a 50-item throughput guarantee.

Rollback of an applied receipt's source record does not remove the receipt.
Database/backup recovery must restore records and receipt metadata together.
Receipt schema removal would discard delayed-retry protection and must not be
used as an ordinary application rollback.

## Evidence

The official PostgreSQL [transaction tutorial](https://www.postgresql.org/docs/current/tutorial-transactions.html),
retrieved 2026-09-17, describes all-or-nothing persistence and visibility. The
implementation uses one database transaction rather than a later receipt write.
`verify-sync-push.ts` checks concurrent and delayed replay, source tracking,
current/deleted records, cross-account identities, partial results, ordinary
session-end interoperability, metadata retention, account deletion, and injected
failure after receipt insertion. It compares records, financial history, mileage
and aggregate state before/after failed transactions. Shared/unit tests cover
contract rejection and privacy-safe classifications. HTTP smoke exercises both
session transports with real authentication and database writes. Run evidence is
recorded in `docs/product/sync-push-checkpoint.md`.
