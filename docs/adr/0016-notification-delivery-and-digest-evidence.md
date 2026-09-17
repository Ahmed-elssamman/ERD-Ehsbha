# ADR-0016: Account delivery preferences and recorded digest evidence

**Status**: accepted
**Date**: 2026-09-17
**Owner**: Driver product and platform teams

## Context

The inbox loaded only its first 50 records and treated failed reads as empty.
Digest generation ignored preferences and created another notification on every
manual or scheduled invocation. Stored Arabic text and financial names described
trip take-home earnings as net hourly profit. Historical tips did not preserve
sample counts or their evidence window. Goals permit custom date ranges.

## Decision

Keep the existing React, NestJS, and Prisma architecture. Introduce account-owned
digest preferences with daily, three-day, and weekly Cairo calendar cadence,
delivery time, and quiet hours. Existing accounts retain enabled daily delivery
at 08:30; quiet hours default to 23:00–07:00. Settings control the implemented
inbox digest producer. Device wellness reminders remain separate.

Use expected-version checks and the existing driver mutation receipt transaction
for preference updates. The account-scoped IndexedDB draft stores a stable body
and mutation identity before sending. A lost-response retry returns current saved
preferences without undoing a subsequent edit. A stale new update conflicts.
No background submission of an unconfirmed preference draft is introduced.

Run the scheduler every fifteen minutes with Cairo time and `waitForCompletion`.
This prevents overlap inside one process, but each application instance still
has its own scheduler. Serialize creation with the driver write lock and enforce
a unique `(driverId, eventKey)` in PostgreSQL. The key includes the Cairo date;
manual and scheduled requests share it. Manual delivery is explicitly on demand
and may run with automation off, while retaining the one-snapshot-per-day limit.
Successful manual capture starts the cadence interval too. Delivery can recover
later the same day, outside quiet hours; missed days are not backfilled.

Scan active drivers in batches of 100, excluding disabled settings and already
captured day identities. Resolve eligibility after the driver lock so a committed
preference change is observed before capture. Read source facts and financial
projections under that lock. Failed creation rolls back its delivery identity.

Capture version 2 evidence from the previous thirty completed Cairo days. Use
integer piastres, BigInt accumulation, safe JSON numbers, actual trip durations,
and an explicit missing state. Trip-start-hour observations need three trips.
Area comparisons need five trips and twenty paid kilometres per compared area.
Platform comparisons describe recorded take-home totals for the snapshot weekday.
They are historical descriptions, not a promise of earnings. Waiting and operating
expenses are excluded from trip comparisons; recorded net operating income is a
separate aggregate measure. Goal progress uses the saved goal's start/end dates.

Bound the trip-detail read at 10,001 rows. Above 10,000, omit every trip comparison
and disclose its absence; complete recorded aggregate totals remain available.
Preserve existing notification rows and JSON snapshots. The earliest old digest
per driver/Cairo day reserves that day's identity without deleting duplicates.
Convert existing naive sent/read timestamps as UTC. Legacy comparisons and targets
are not displayed because they lack the saved evidence needed to substantiate them.

The inbox uses owner-scoped `(sentAt DESC, id DESC)` pagination, visible failures
and retries, stable first-read timestamps, and a bounded mark-displayed action.
Display known digest fields in the current UI language; do not evaluate arbitrary
stored translation keys. Reject cross-account reassignment of a device token.

## Alternatives

A process-local flag would not coordinate multiple API instances or manual
requests. Generic HTTP idempotency alone would expire independently of the Cairo
delivery identity. Replacing old snapshots would erase the financial context
previously delivered. Use database identity and versioned evidence instead.

## Consequences

This is part of the coordinated contract-major-2 worktree: notification responses,
pagination, and digest behavior are incompatible with old consumers. The new
preference routes are additive. Invalidate the old persisted query cache through
its version marker while retaining account-owned record drafts.

Browser push, maintenance/license/report notification producers, automatic report
delivery, and production multi-instance operation remain separately unverified.
An arbitrary registered device token is not evidence of working browser push.
Scheduler failures are counted in operational logs without exposing driver IDs
or financial records; deployment monitoring still needs production validation.

## Verification

Mandatory PostgreSQL notification checks cover migration preservation, settings
receipt rollback and replay, conflicting versions, owner-scoped cursors, repeated
reads, device ownership, concurrent generation, custom goal periods, money units,
sample limits, disabled delivery, cadence, locale, and inactive accounts. Unit
checks cover Cairo daylight saving and invalid schedules. Browser checks exercise
lost replies, offline drafts, stale updates, missing history, one daily snapshot,
pagination/read failures, and Arabic mobile layout. See the notification checkpoint
for current command results; this ADR does not assert deployment readiness.

## References

- [NestJS Cron decorator](https://github.com/nestjs/schedule/blob/master/_autodocs/api/cron-decorator.md), retrieved 2026-09-17: `waitForCompletion` skips overlapping callbacks.
- [NestJS scheduler implementation](https://github.com/nestjs/schedule/blob/master/lib/scheduler.orchestrator.ts), retrieved 2026-09-17: scheduler jobs are process-local; database coordination is still required.
- [Recorded work sessions](0014-recorded-work-sessions.md)
- [Wellness and work indicators](0015-wellness-and-work-indicators.md)
