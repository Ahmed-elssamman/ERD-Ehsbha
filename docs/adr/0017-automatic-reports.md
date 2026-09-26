# ADR-0017: Saved automatic reports from recorded financial evidence

**Status**: accepted
**Date**: 2026-09-17
**Owner**: Platform engineering

## Context

Live analytics cannot preserve what a driver saw in a past weekly or monthly
report. Recorded costs, corrections, delivery preferences, and local wellness
retention must remain explicit when introducing an automatic report archive.

## Decision

Extend the existing React/NestJS application with completed Cairo ISO-week and
Gregorian-month reports. One driver/period/start-date identity owns a current
snapshot and append-only numbered revisions. Opening or creating an existing
period returns its current saved version. Explicit revision requires its current
version. Source corrections do not silently rewrite a saved report. Notifications
link to the exact version announced.

Create, revise, and preference updates use the established driver write lock,
durable mutation receipts, and account-scoped browser drafts. Replaying a confirmed
operation returns the current record without undoing a later change. Source reads,
current snapshot, revision, receipt, and scheduled notification writes share one
transaction. All report and cursor access is owner scoped. Account deletion
cascades through these records.

## Financial basis and limits

Daily financial projections supply complete current and previous period totals,
gross/commission coverage, distance and unioned completed work time. Missing
denominators remain null. Integer-safe arithmetic rejects unsupported values.
Platform contribution excludes unallocated operating expenses and is labelled
separately from net operating income. No future earning or health claims are made.

The `report_cash_ledger` view follows the same expense/link rules as financial
projections: a linked fuel, maintenance, toll or parking payment counts once at the
expense timestamp. Readers explicitly interpret source timestamps as UTC and dates
as Cairo dates regardless of SQL session timezone. Capture rejects any discrepancy
between ledger costs and projected costs. Future changes to cash rules must update
the projection and ledger together, with their reconciliation test.

Vehicle assignment is explicit; no allocation is invented for unassigned costs.
Fuel purchase/service record totals are informational and may have dates different
from their linked payments. They must not be added to operating costs again.
Daily results include all period dates, distinguishing absent activity. Largest
costs query the complete ledger, capped at ten displayed entries. Platform and
vehicle detail cap at 200 groups; exceeding that limit omits the breakdown with
an explicit notice while retaining complete totals. Archive/history queries fetch
summary fields only, with bounded owner-scoped cursor pages; history sorts by
immutable version descending.

## Delivery and wellness

Separate report settings preserve existing digest preference commands and receipt
replays. Weekly and monthly reports default enabled at 09:00 Cairo, with quiet
hours 23:00–07:00. The 15-minute scheduler checks active drivers in batches of 100,
rechecks preferences after acquiring their write lock, and captures only the latest
completed periods. There is at most one inbox event per driver/period. No backlog
of older periods is sent. The inbox is the implemented delivery channel.

An existing manually captured report is preserved. If that snapshot has no recorded
activity, automation does not notify about it or silently revise it; a later
explicit nonempty revision can become eligible before that period ceases to be the
latest completed period. Revisions after delivery do not send repeat notices.

Wellness remains optional and device local, retained for seven Cairo dates. Its
available answers appear separately from the saved financial snapshot. Missing or
expired answers are not interpreted as skipped or as a medical assessment. Report
generation does not upload wellness data.

## Alternatives

Recomputing every archived view from live records would silently change past
reports. Automatically overwriting a snapshot on correction would erase its
original evidence. Uploading wellness to fill old reports would change the
established privacy model. These alternatives are not adopted.

## Consequences

Drivers explicitly save a new version after corrections. Revisions add database
storage and account deletion removes them with the account. The cash ledger and
financial projections must evolve together. Old browser bundles cannot parse the
new report notification kind; deploy API and browser consumers together under the
existing coordinated contract cutover and invalidate persisted account queries.

## Validation status

Implementation and acceptance verification are in progress. Final PostgreSQL,
browser, contract, security and build evidence belongs in the reporting checkpoint;
this decision document does not assert completed verification.
