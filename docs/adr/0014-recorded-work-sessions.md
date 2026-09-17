# ADR-0014: Recorded work time across platforms

**Status**: accepted
**Date**: 2026-09-17
**Owner**: Driver product and platform teams

## Context

The dashboard displayed recorded hours without a session capture workflow. Trips
alone omit waiting between trips. Existing sessions require one platform; assigning
an entire multi-platform shift to a default platform would distort comparisons.
The open-session endpoint also returned a null value that the global interceptor
turned into an incompatible success object. History was capped without paging,
and drivers could not correct or cancel mistaken sessions.

## Decision

Keep the existing session domain and make its platform reference nullable. New
driver-browser sessions represent overall work time. Existing platform-attributed
records retain their reference and deletion restriction; time correction does not
change attribution. Do not infer platform usage, continuous activity, or medical
facts from an open session.

Total hours remain the union of trips and completed, non-deleted sessions, clipped
to Cairo reporting days. Overall sessions contribute only to driver totals.
Platform sessions contribute to their existing platform. Overlap never counts
twice. Open sessions do not increment financial reports; their actual end must be
recorded first. A driver records breaks by ending work and starting another period.

Add a mobile driver page with start/end, missed-session entry, time correction,
explicit deletion/restoration, and paged change history. The dashboard hours link
and navigation lead to this page. Labels explain recorded rather than inferred
hours. New missed sessions start with blank time fields, not fabricated intervals.
Cairo's repeated clock times require an occurrence choice. Keep original instants
when the displayed wall time is unchanged. Intervals retain the existing seven-day
maximum and must be positive. Server validation rejects future times beyond a
one-minute allowance for clock skew.

Sessions have optimistic versions. End/correct/delete/restore commands carry the
reviewed version, and each action has its own stable identity. Ordinary starts
now join the durable receipt protocol in ADR-0013. All mutations commit source,
revision, receipt and affected projections under the existing driver row lock.
Replay returns the current record before applying version checks. A late retry
cannot reopen a completed session or repeat a deletion after restoration.

Soft deletion retains the record and history. The partial database uniqueness
constraint allows one non-deleted open session per driver. Restoring an open
session conflicts if another is open. Revisions retain only attribution, times,
duration, deletion state and version, with UTC creation instants. No fabricated
historical revisions are backfilled. Account deletion cascades revision and
receipt metadata.

The browser reuses account-scoped IndexedDB drafts, revision/generation checks,
immutable pending requests, and cleanup tombstones. It persists exact command
times and identity before sending. Reload, lost responses, storage failure and
stale tabs use the existing explicit recovery flow. Successful response cleanup
can retry locally without another network write. No automatic background work
recording or financial submission is added.

Open-session reads return `{ session: record | null }`. List/history have bounded
continuations with timestamp and ID ordering and owner/filter scope validation.
All four existing session operations join the unpublished contract-2 coordinated
cutover; six new operations cover get/history/create/correct/delete/restore.

## Alternatives

- Assign all work to the first configured platform: would invent attribution and
  excludes drivers who have no configured platforms.
- Create another parallel shift subsystem: duplicates time storage and union
  calculations while leaving existing sessions and their recovery unresolved.
- Treat the open timer as worked time: abandoned sessions inflate income/hour
  denominators and are not evidence of continuous work.
- Replace saved times without history or a reviewed version: silently overwrites
  another device's correction and prevents financial reconciliation.

## Consequences

API, driver, contracts and migration ship together. The platform FK becomes
optional while existing restrictions and historical meaning remain. Consumers
must handle nullable attribution and explicit open/list responses. The ordinary
end schema now requires a reviewed version as well as identity.

Recording work remains driver input, not verified platform telemetry. A forgotten
long-open period needs explicit actual end-time review or cancellation. This
work enables meaningful recorded-hour reports; configurable wellness reminders
and broader reporting requirements remain separate master work.

## Evidence

`verify-work-sessions.ts` exercises actual PostgreSQL transactions, total versus
platform time, overlaps, replay after correction/restoration, owner-scoped reads,
stale versions, open-session races, cursor bounds, future-time rejection, and
injected failure after receipt insertion. The Cairo integration suite continues
to cover 23/25-hour days using past dates compatible with recorded-time validation.
Shared contract and browser unit tests cover shapes and ambiguous Cairo times.
`work-sessions.spec.ts` exercises real HTTP/database journeys in English and
Arabic, lost replies, reload, stale corrections, abandoned periods, device-storage
failure, history, and 320px layout. Current run evidence belongs in the product
checkpoint after final verification completes.
