# Financial reconciliation

17 September 2026. This change repairs repeatability and concurrency of existing
financial projections. The complete product roadmap remains active.

## Behavior and calculation

Previously, rebuilding a day replayed increments into existing weekly, monthly,
platform and area totals. Rebuilding the same day changed the answer. Weekly and
monthly net also omitted tips and commission. The real PostgreSQL regression
reproduced both faults before the implementation changed.

Trip, fuel, expense, daily odometer and session writers now acquire the same driver row lock,
write the source, and replace affected projections inside one transaction. Day
reconciliation reads current source records. Weekly and monthly values sum daily
values, including daily net. The nightly job, repair command and development seed
use this service. A failed calculation rolls back the source and projections.

- Money stays integer piastres; aggregate arithmetic uses BigInt. Net is gross
  plus tips minus commission, fuel, expenses and maintenance amortization.
- Trip toll and parking amounts contribute to expenses. A waiting fee is already
  part of the fare and is not added to gross again.
- Fare, distance and trip count belong to the trip's start date. Working time is
  the union of overlapping trips and closed sessions, clipped to each day. An
  ongoing session contributes after it closes. Platform time uses that platform's
  intervals, so simultaneous platform times need not add to the driver total.
- A recorded daily odometer total replaces the summed trip distance for that
  day. Paid distance still comes from trips; the remainder is empty distance.
  A total below paid distance rejects the source change with a localized conflict
  message. Correct the recorded total or trip distance before retrying. Rebuilds
  and weekly/monthly rates preserve this source record.
- Duration rounds once per day to whole minutes. Rates use exact integer
  rounding, including negative income and zero denominators. Values outside the
  existing signed 32-bit ratio columns reject the transaction rather than wrap.
- New/edited trip intervals and closed sessions must be positive and at most
  seven days. This limits synchronous day reconciliation and rejects implausible
  date spans. Existing unusually long records require review before repair.
- Reporting now uses Cairo calendar dates with ISO Monday-based weeks. The
  explicit legacy cutover and DST semantics are in `cairo-reporting-calendar.md`.

The existing maintenance amortization estimate and fuel-efficiency field are
preserved; this change does not establish how those estimates should be derived.
Platform/area `netProfitPiastres` still means contribution before unallocated
operating costs. Renaming and explaining this in driver/admin views is pending.
Two independently entered cost records remain two records: linking a standalone
toll/parking expense to its trip fee, with conflict review, is still required.
Net-only evidence and coverage counts are described in `net-only-income.md`.
General financial correction history remains unfinished. These limits prevent
a claim of complete financial correctness.

## Files

- `apps/api/src/modules/aggregates/aggregate-calculation.ts`, `aggregate.model.ts`,
  `aggregate.control.ts`, `aggregate-repair.ts`, `aggregates.service.ts`: typed
  arithmetic, bounded source projections and resumable repair.
- `apps/api/src/modules/{trips,fuel,expenses,sessions,odometer}/*.service.ts`: coordinated
  writes, atomic reads/updates/deletes and session start/end concurrency.
- Admin bulk trip deletion/restoration, audit service and module wiring:
  soft-delete/restore, projections and audit records commit together, with sorted
  driver locks for multi-driver operations. Daily odometer module imports the
  shared aggregate service. Driver manual/OCR and admin errors explain distance
  conflicts in Arabic and English through the shared governed error code.
  Driver trip reads/edits exclude admin-deleted records; historical OCR receipts
  remain available for replay without recreating a deleted trip.
- `apps/api/src/modules/analytics/nightly-aggregates.job.ts`,
  `analytics/engines/profit.engine.ts`, `apps/api/prisma/seed.ts`: shared calculation
  path instead of duplicate increment/rounding implementations.
- `apps/api/src/modules/fuel/fuel-response.mapper.ts` and `fuel.controller.ts`:
  Prisma Decimal/BigInt values become contract-valid JSON numbers.
- `apps/api/prisma/schema.prisma` and migration
  `20260917150000_aggregate_interval_indexes`: interval lookup indexes and a
  database-enforced single open session per driver.
- `packages/api-contracts/src/domains/trip-details.ts`, `trip-ocr.ts` and tests:
  shared maximum interval validation.
- `apps/api/scripts/repair-aggregates.ts`, `test-financial-integrity.ts`,
  `verify-aggregate-integrity.ts`, `test-integration.ts`, API package scripts and
  `scripts/verification/verify.mjs`: repair entry point and blocking database gate.
- Aggregate calculation tests, driver HTTP agreement tests and
  `apps/web/tests/browser-integration/ocr-journey.spec.ts`: arithmetic, serialization
  and financial results after actual browser confirmation.

The existing React/Nest architecture is preserved. New production calculation
code uses explicit interfaces, enums and companion configuration; it has no UI
state or presentation strings. Legacy typing elsewhere is not claimed resolved.

## Existing data and deployment

Only the disposable local test database has been migrated during this work. No
production records have been repaired. Use the normal coordinated release and
backup/restore procedure before applying these changes to a live database.

Before the unique index migration, inspect duplicate open sessions:

```sql
SELECT driver_id, count(*)
FROM sessions WHERE ended_at IS NULL
GROUP BY driver_id HAVING count(*) > 1;
```

Resolve any results using verified session times; the migration intentionally
does not fabricate end times or silently delete records. Drain old API writers
before rollout so old delta writers cannot reintroduce inconsistent totals.
Also inspect legacy trips/closed sessions with nonpositive or over-seven-day
intervals before planning repair. Do not truncate historical financial records.
Review daily odometer totals below the sum of non-deleted trips' paid distance;
these records need an explicit source correction before their day can reconcile.

From the repository root, with the intended database environment configured:

```powershell
npm --workspace @ehsbha/api run repair:aggregates -- --driver=DRIVER_ID
npm --workspace @ehsbha/api run repair:aggregates -- --driver=DRIVER_ID --apply
```

The default is a read-only count of planned source/projection dates and existing
periods. Omitting `--driver` includes all drivers, paged in groups of 100. Empty or
repeated driver arguments fail. Preview is advisory if writers remain active.
Start with one reviewed driver, compare source totals, then run the approved
scope. **Do not use the development seed as a production repair command.**

Each day commits atomically, followed by repair of existing period rows, including
orphan rows left after deletions. The whole repair is not one transaction; reports
may contain a mixture of repaired and old days until it finishes. A failure stops
the command with a nonzero exit code. Rerunning is safe and resumes by replacing
the same derived values. Source transactions and OCR receipts are not rewritten.
Export before/after aggregates for accounting review; do not restore corrupt
totals as a substitute for rolling back the application release.

## Evidence

The PostgreSQL harness covers all five projection families, repeated rebuilds,
corrupted totals, concurrent partial edits, transaction rollback, competing
session starts/ends, the database open-session constraint, concurrent deletion,
cross-midnight/month trips, ISO week/year boundaries, driver isolation and
repeated full repair including stale periods.
Additional checks preserve odometer overrides, reject inconsistent distance
changes, race admin deletion, restore totals and roll back on audit-write failure.

Focused run `verification-output/finance-after-7.log` passed. A synthetic day of
1,000 trips, ten samples, measured local p95 of 40 ms for rebuilds and 51 ms for
expense writes including reconciliation. This is a small local PostgreSQL/service
measurement, excluding HTTP, network latency and production concurrency.

The repair CLI passed a separate disposable-database check for read-only preview,
an odometer-only date, repeated application and an empty driver argument. Logs:
`verification-output/finance-repair-cli.log` and
`verification-output/finance-repair-empty-driver.log`.

Full gate evidence is recorded in the engineering roadmap. The browser journey uses real
authentication, application services and PostgreSQL; recognition remains a
deterministic provider fixture, not evidence of cloud OCR accuracy.
