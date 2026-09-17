# Cairo reporting calendar

17 September 2026. Implementation and verification under master sections 9, 10,
11, 21 and 29. The wider product roadmap remains active.

## Business rules

Trip and expense entry, trip display, date filters and financial reporting use
`Africa/Cairo`, independently of the browser, API host and database session zone.
An instant is still stored and exchanged in UTC. A PostgreSQL `DATE` value is a
calendar label; Prisma's UTC-midnight representation of that label is not the
instant when the Cairo day begins. Daily odometer and goal dates remain labels.

- Trip count, fare and distance belong to the Cairo date of the trip's start.
  Work intervals are clipped to actual Cairo day boundaries and unioned before
  minute rounding. A trip ending exactly at midnight contributes no time to the
  next date. Closed sessions follow the same rule.
- Fuel and expenses belong to the Cairo date of their recorded instant. Weekly
  reports use ISO Monday-based weeks; monthly reports use Gregorian months.
  Calendar windows include today and the preceding N-1 dates, through the end of
  today. Rolling fatigue intervals remain actual elapsed hours.
- A spring day can contain 23 hours and an autumn day 25 hours. Calendar-day
  arithmetic must not use 24-hour increments on source instants. The shared
  helper finds actual boundaries with the runtime IANA timezone rules.
- A nonexistent clock time is rejected. A newly entered repeated clock time
  requires the driver to choose before or after the clock change. An unchanged
  edit preserves the recorded occurrence and milliseconds. Manual and OCR review
  share the resolver and occurrence control. Saving a displayed local time never
  delegates interpretation to `new Date(localInput)`.
- Current-date browser queries refresh at Cairo midnight and when a suspended
  tab regains focus. Driver/admin report failures offer retry instead of displaying
  failed data as empty totals. Financial report and form copy identifies Cairo time.

## Legacy data and rollout

Migration `20260917180000_cairo_reporting_calendar` adds a per-driver marker.
Existing drivers receive `UTC`; new drivers default to `CAIRO`. It does not shift
source timestamps or relabel old projections in place. This is a coordinated
API/driver/admin release, including the stricter daily-report date query contract
(`YYYY-MM-DD`) and bounded 1–3650-day comparison windows.

For a legacy driver, rebuild all affected dates and periods under the same driver
write lock in one database transaction, then change the marker to `CAIRO`.
Dates include source dates and old projection dates, so stale UTC buckets are
cleared. App, area, daily, weekly and monthly totals switch together. Old active
recommendations expire; their history remains. Today's score is recalculated;
historical score snapshots remain as recorded.

Manual odometer labels and existing daily maintenance estimates retain their
dates and values. They are not inferred from trip timestamps. If an odometer
total is below the paid distance now assigned to that Cairo date, the entire
cutover rejects with `DAILY_DISTANCE_CONFLICT`. Correct the conflicting records
from verified source information, then retry. Do not invent mileage, discard
records or mark the driver migrated to bypass validation. Multiple historical
conflicts may require an operator to apply reviewed corrections together before
retrying; the normal source writer also enforces an all-or-nothing cutover.

Normal driver report reads and source writes ensure the calendar before returning
projections. Cross-driver admin financial reports return
`REPORTING_CALENDAR_PENDING` (503) until all legacy drivers have been rebuilt.
The response uses a governed error code and localized retry guidance.

Run against the explicitly selected deployment database after normal migration
preflight and backup review:

```powershell
npm --workspace @ehsbha/api run repair:aggregates -- --driver=DRIVER_ID
npm --workspace @ehsbha/api run repair:aggregates -- --driver=DRIVER_ID --apply
```

Omitting `--driver` visits all drivers in pages. Preview is read-only and reports
`pendingCalendars` at scan time. Apply commits each driver's calendar cutover
atomically; its later reconciliation passes remain resumable per day/period.
The CLI allows 120 seconds for a legacy cutover, versus 15 seconds for an
interactive rebuild. A timeout leaves the driver marker and all its projections
unchanged. Large production histories require a measured maintenance window;
the local tests do not establish production migration duration. Nightly repair
runs at 03:17 Cairo; the digest schedule runs at 08:30 Cairo.

During rollout, prevent old API workers from writing UTC projections after new
workers have migrated a driver. Rolling back only the application would mix
calendar semantics. A rollback needs either restoration of a consistent pre-cutover
database/application snapshot or a reviewed reverse projection rebuild. Source
facts remain UTC and are not modified by calendar reconciliation.

## SQL and research

The stored Prisma `timestamp without time zone` columns contain UTC. Convert
them with `started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Cairo'`. Prisma's
bound Date parameters are instants; compare with explicit UTC timestamp bounds
using `parameter::timestamptz AT TIME ZONE 'UTC'`. A direct cast to timestamp
uses PostgreSQL's session timezone and can shift a bound twice. The regression
database's session timezone is Cairo, which exposed this bug during verification.

Sources consulted on 17 September 2026:

- [IANA Africa timezone source](https://data.iana.org/time-zones/tzdb/africa):
  Egypt's current rules start summer time on April's last Friday at 00:00 and
  end it on October's last Thursday at 24:00. In 2026, 24 April skips 00:00–00:59;
  29 October repeats 23:00–23:59. Do not hard-code a permanent UTC+2 offset.
- [PostgreSQL date/time functions](https://www.postgresql.org/docs/16/functions-datetime.html)
  and [date/time types](https://www.postgresql.org/docs/16/datatype-datetime.html):
  the two `AT TIME ZONE` directions and the distinction between dates, instants
  and timestamp values without a timezone.

Node/browser Intl and PostgreSQL ship timezone data independently. Keep both
current and run the boundary agreement tests before release; no fixed-offset
fallback is claimed to handle future changes in Egyptian law.

## Changed areas and verification

Primary new files:

- `packages/shared-types/src/business-date.ts`, `business-date.control.ts`,
  `business-date.spec.ts`, and `zoned-time.control.ts`.
- `apps/api/prisma/migrations/20260917180000_cairo_reporting_calendar/migration.sql`,
  `apps/api/src/modules/aggregates/aggregate-repair-query.ts`, and
  `apps/api/scripts/verify-cairo-calendar.ts`.
- `apps/web/src/hooks/use-business-date.ts`,
  `apps/web/src/components/ui/local-time-choice.tsx`, its `.control.ts`, and
  `apps/web/src/components/report-load-error.tsx`.
- `apps/web/src/pages/expenses/expenses.control.ts`, its `.spec.ts`,
  `apps/web/src/pages/trips/trips-list.control.ts`, and its `.spec.ts`.
- `apps/web/tests/browser-integration/cairo-calendar.spec.ts` and
  `apps/web/tests/browser/report-recovery.spec.ts`.
- This document and `docs/product/expense-integrity-audit.md`.

Modified files by domain:

- `packages/shared-types/src/index.ts`, `zoned-time.ts`, `zoned-time.spec.ts`;
  `packages/api-contracts/src/domains/analytics-intelligence.ts` and its test;
  the shared error catalog and generated contract artifacts.
- API Prisma schema; aggregate service/control/repair; fuel/expense writers;
  analytics service/controller/nightly job; admin analytics/dashboard/driver
  services; odometer, goals, score, recommendations and digest services and
  their module dependencies. Repair CLI, smoke, aggregate regression,
  integration runner and root verification gate.
- Driver `lib/time.ts`, `lib/format.ts`; trip form/control/test/list;
  OCR multi-trip review; expense, analytics, dashboard, settings and score pages;
  Arabic/English dictionaries; real take-home browser journey timezone.
- Admin date formatting utilities, trip list/detail, driver detail, analytics
  page and bilingual dictionary. Product audit, reconciliation, income and
  roadmap documents reference the new calendar policy.

Implementation and evidence:

- Shared calendar, local-time resolver and unit tests:
  `packages/shared-types/src/business-date*`, `zoned-time*`, and exports.
  Cairo date/time formatters are reused. In a local Node benchmark of 50 samples,
  resolving two repeated-hour times for each of 20 candidates improved from
  p95 29.8 ms to 3.5 ms after formatter reuse. This is a domain microbenchmark,
  not a mobile browser interaction measurement.
- Prisma schema/migration and aggregate service, repair query/CLI, cost writers,
  analytics/admin readers, odometer, goals, score, recommendations and digest.
- Driver time formatting, manual/OCR forms, expense controls, date filters,
  report error states and midnight query refresh; admin timestamp formatting,
  report errors and bilingual copy. Existing React/Nest architecture is retained.
- Shared analytics/error contracts and generated contract artifacts.
- `apps/api/scripts/verify-cairo-calendar.ts` runs in the real database gate.
  It checks SQL/Intl agreement, midnight/month allocation, DST duration, costs,
  all five projections, read-only preview, rollback, concurrent cutovers,
  source preservation, odometer/maintenance preservation and repeatable repair.
- Browser journeys exercise a UTC device and a Los Angeles device against real
  services/PostgreSQL. OCR recognition still uses a deterministic provider fixture.

Full root verification passed in run `2026-09-17T01-51-17-596Z-22788`; log:
`verification-output/cairo-root-verify-2.log`. It includes clean migrations,
273 API unit tests, 116 package tests, PostgreSQL integration, 41 smoke checks,
18 intercepted browser regressions and three real API/database browser journeys,
production builds, contracts, boundaries, route audit, artifact measurements and
security checks. All 21 browser tests passed with no skips or flakes. Separately,
42 web unit tests and 597 supplementary verification checks passed.

The first full run caught the smoke fixture passing an instant to the now
date-only daily-report query. It now requests the trip's Cairo date and validates
each report response before comparing money; failed reads cannot become a zero
baseline. Focused smoke and all browser regressions passed before the full rerun.
Database checks also exposed and fixed the session-timezone-sensitive SQL bound
conversion described above. Assertions and financial constraints remain enforced.

The shared formatter optimization was followed by package tests, browser tests
and the final full gate. Diff checks passed. No production database has been
migrated or repaired. Reports are diagnostic on the inherited dirty worktree;
this checkpoint is not release certification or completion of the full product.
