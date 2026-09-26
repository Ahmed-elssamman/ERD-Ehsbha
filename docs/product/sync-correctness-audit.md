# Sync correctness audit — 17 September 2026

Inspected while the manual-trip checkpoint was under verification. The pull
findings below were subsequently addressed by the bounded reconciliation design
in [ADR-0012](../adr/0012-sync-reconciliation.md). The historical findings explain
the change. Push replay/error classification is subsequently addressed by
[ADR-0013](../adr/0013-driver-mutation-receipts.md) and its
[checkpoint](sync-push-checkpoint.md). Browser sync remains open.

## Confirmed findings

- `apps/api/src/modules/sync/sync.service.ts` limits each trip, fuel, expense and
  session query independently, then returns the current time as one global
  cursor. A first pull with more rows than the limit can permanently skip the
  remaining older rows on the next pull. Sorting only by `updatedAt` also omits
  a stable tie breaker. Cursors are arbitrary date strings rather than bounded,
  validated, owner-scoped continuation tokens.
- Vehicles and goals are unbounded queries. Areas and app bindings are returned
  as full snapshots on every request. Recommendations use a separate timestamp,
  descending order and a limit of thirty. The response does not explain whether
  a family is a snapshot, complete delta or truncated delta, or expose per-family
  continuation. Incremental disappearance and hard deletion need an explicit
  removal protocol.
- The controller imports locally duplicated pull/push schemas from its service.
  The shared contract in `packages/api-contracts/src/domains/platform-operations.ts`
  uses untyped entity/payload maps. Active sync operations are already included
  in the unpublished major-2 incompatible-operation manifest.
- The current driver app has no discovered sync-pull transport caller. Its OCR
  and operating/manual drafts use their dedicated APIs and local recovery
  protocols. Fixing this endpoint alone would not create browser offline sync.
- Push covers trip/fuel/expense creation and session start/end. Trip creation now
  stamps sync origin through the normal trip service. Push error classification
  and session-end replay semantics still need direct review.

## Follow-up push inspection (historical findings)

Direct inspection after the pull implementation confirmed the following issues,
which motivated ADR-0013:

- `SyncService.push` maps every exception except a literal `CONFLICT` code to
  `VALIDATION_ERROR`, including internal failures and more specific conflict
  codes. It returns/logs exception messages, which can include storage details.
  Its request/result maps are still untyped, and the local push schema is less
  strict than the shared schema. Replace these together with typed per-kind
  requests/results and governed, privacy-safe classifications.
- Session end drops the outer `clientMutationId`. `SessionsService.end` rejects
  every already-ended session, so replay after a lost success is a conflict even
  when it repeats the original operation. The ordinary session-end controller
  also has no idempotency decorator. A fix must survive the crash window between
  the domain transaction and any later receipt write; simply returning every
  ended session would hide a different requested end time.
- Session start already stores its mutation ID and checks supplied fields under
  the driver lock. Trip/fuel/expense creation have their own existing replay
  protections. Preserve those paths when introducing typed sync handling.
- No actual session transport caller was found in the current driver browser;
  matches for `session.submit` are the local record-draft abstraction. Browser
  work/session capture, sync push, and generic draft recovery are distinct flows.

## Required design and evidence (historical acceptance criteria)

Specify snapshot versus delta behavior, typed entity families, limits,
continuation, removals, retention and restart behavior before implementing a
client. Preserve existing per-record mutation identities and owner checks.
Do not advance a cursor past undelivered data. An implementation must also account
for writes that begin before a pull and commit after it; a wall-clock watermark
or sequence allocated before commit is not sufficient evidence that all earlier
changes were delivered. Choose a bounded protocol with a documented consistency
guarantee rather than merely changing the sort order.

Required PostgreSQL tests include more than one page in every family, identical
timestamps, mixed family sizes, concurrent writes and removals, cursor reuse by a
different account, invalid/expired continuations, interrupted pulls, and replay
of financial and session mutations. Client sync, if introduced, needs account
isolation, explicit conflict/recovery behavior and privacy-preserving cache
retention. The current device-draft guarantee must remain independent and intact.
