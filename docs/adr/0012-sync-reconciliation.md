# ADR-0012: Bounded reconciliation for sync pull

**Status**: accepted
**Date**: 2026-09-17
**Owner**: Platform team

## Context

The old pull endpoint independently capped some families, left others unbounded,
and returned the current wall clock as a global delta cursor. Remaining records
could be permanently skipped. Timestamp ties, delayed commits, hard deletion,
lookup changes, and recommendation expiry had no complete protocol. There is no
driver-browser consumer of this endpoint in the inspected worktree.

## Decision

Use a **rolling full reconciliation**, not a timestamp delta or a transactional
snapshot spanning HTTP requests. Keep the existing nine families: trips, fuels,
expenses, sessions, vehicles, areas, app bindings, goals, and recommendations.
Maintenance and daily odometers retain their dedicated APIs; they were not part
of the previous sync response. No financial write or draft behavior changes.

Start with `POST /api/v1/sync/pull` and `{ "limit": 25 }`. Each response contains:

- `mode: "RECONCILE"`, a random `cycleId`, `startedAt`, and `expiresAt`;
- `page: { kind, items }`, with one explicitly typed family and at most 100 items;
- `nextCursor`, which is null only after the final family has been scanned.

Send a non-null `nextCursor` as the next request's `cursor`. Empty pages also
require continuation. The limit defaults to 25, is capped at 100, and may change
between pages. Every new cycle starts without a cursor and scans current state
again. The last response's null continuation is **not** a delta watermark.

Within each family, seek by immutable record ID in ascending database order,
using `(driver_id, id)` indexes. Existing unique indexes cover trips, expenses,
and vehicles; the migration adds the remaining six. An initial repeatable-read
transaction captures each family's largest eligible ID. These bounds prevent
ordinary later appends from continually extending the cycle. They do not freeze
record contents. Deleted cursor anchor rows do not prevent continuation.

Tokens carry the version, owner scope hash, cycle ID/start, fixed family bounds,
current family, and last ID. HMAC-SHA256 covers the entire payload with a distinct
sync purpose prefix and the configured driver access signing secret. Tokens are
limited to 4096 characters and expire 24 hours after the original cycle start;
continuation does not extend this lifetime. Every query still independently
filters by the authenticated driver. Tokens contain record IDs, never financial
payloads. The server stores no snapshot copies, tombstone ledger, or extra driver
financial history for this protocol.

Malformed, tampered, foreign, future, expired, old timestamp, or signing-key-
rotated continuations return governed `INVALID_CURSOR`. The recovery is to
discard that incomplete staging cycle and start again without a cursor. The
existing visible cache and pending drafts remain intact.

## Consistency and removals

If a driver's records stop changing, a complete cycle begun afterwards returns
all current eligible records exactly once. Repeated complete cycles therefore
converge, including writes whose transactions began before an earlier pull but
committed after its read. Equal timestamps do not affect coverage. A row inserted
behind the current position or above the initial bound, or changed after its
page was read, is picked up on a subsequent cycle. There is no claim of observing
every intermediate version; financial revision history has its own endpoints.

Soft-deleted financial records remain in the scan with their deletion state and
version. Hard-deleted records are absent on a later complete cycle. App bindings
include current platform metadata each cycle. Only currently undismissed,
unexpired recommendations are eligible; their explicit expiry must also be
enforced by the client while offline.

A future client must stage pages by account and cycle, upsert by family and ID,
and promote/prune the replicated server cache only after all pages finish.
Persist a page's records and its continuation atomically; advancing the stored
cursor before its records are durable would recreate client-side data loss.
Absence from an incomplete cycle is never a deletion. Replaying a continuation
is safe, but current values may differ if a record changed between requests.
The cycle is not an atomic view of related records and must not replace the
authoritative financial summary APIs.

Local pending writes and device drafts are separate from the replicated cache.
A client must retain or overlay writes acknowledged during a cycle and reconcile
them in a cycle begun after that acknowledgement; an older scan cannot erase
them. Account changes/logout clear the corresponding staging and cached data.
No client integration or automatic financial submission is introduced here.

## Consequences

A full cycle reads all eligible records and needs at least one request per
family, including empty families. Large accounts therefore cost more bandwidth
than a correct incremental change feed would. Bounded pages improve request size
and resumability, not total transfer size. The endpoint is suitable as a recovery
primitive; adopting frequent automatic polling would need workload measurements
and a client policy first.

`platform.sync.pull` was already listed as incompatible in the unpublished
major-2 manifest. Deploy its contract and API together; old timestamp consumers
must restart and adopt the new protocol. The index-only migration does not
rewrite source data. Rolling back API behavior also restores the old correctness
defect and is not a recovery strategy for missed client records.

## Alternatives

A durable change feed was considered. Correct commit ordering, capture across
all write paths, tombstone retention, account deletion, bootstrap, and lock order
would add substantial database machinery without a current browser consumer.
Do not introduce a wall-clock or pre-commit sequence shortcut as a later
optimization. Any delta replacement needs its own consistency proof and tests.

## Research and evidence

PostgreSQL's official [LIMIT/OFFSET documentation](https://www.postgresql.org/docs/current/queries-limit.html),
retrieved 2026-09-17, requires an ordering that uniquely constrains result rows.
The implementation uses ID keyset seeks; it does not infer commit visibility
from timestamps. `verify-sync-reconciliation.ts` exercises PostgreSQL, all nine
families, equal timestamps, multiple page sizes, replay, deleted anchors, updates,
soft and hard deletion, platform renames, expiry/dismissal, and a held transaction
that commits an old-ID/old-timestamp row after a complete scan. Cursor unit tests
cover signature, account, format, lifetime and key rotation. Shared contract tests
and HTTP smoke validate the wire response. Checkpoint evidence is recorded in
`docs/product/sync-reconciliation-checkpoint.md`.
