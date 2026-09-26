# Automatic reporting audit — 17 September 2026

Baseline audit recorded during notification verification. Its report archive,
financial snapshots, revisions and delivery findings are now addressed by the
[automatic reporting checkpoint](automatic-reporting-checkpoint.md). The sections
below preserve the inspected pre-implementation state and acceptance requirements.

## Existing implementation

- `apps/web/src/pages/analytics/analytics.tsx` has current daily, ISO-week, and
  calendar-month tabs. Weekly/monthly tabs show four main totals plus cost and
  financial-coverage notices. There is no saved-report archive or period selector.
- `apps/api/src/modules/analytics/analytics.controller.ts` exposes live daily,
  weekly, monthly, app, area, hour, and forecast readers. It has no saved-report
  create/list/get/download endpoints. No report module or report model was found
  in the module/file inventory or Prisma schema.
- The weekly/monthly readers use existing rebuilt projections. Gross availability
  counters, recorded cash-cost basis, linked expenses, and unioned work sessions
  are established foundations. New reporting must preserve these semantics.
- Platform breakdown currently accepts a rolling number of days ending today,
  so it cannot directly supply an arbitrary archived week or month. Platform
  contribution is a different cost basis from overall operating net. Overall
  work sessions must not be allocated to a platform or vehicle without evidence.
- Existing analytics serialization substitutes zero for some missing ratios and
  converts BigInts directly to Number. New report contracts must explicitly handle
  unavailable denominators and safe monetary boundaries instead of copying this.
- The implemented notification producer is the work digest. Its day identity,
  delivery preferences, inbox, and durable settings updates provide a foundation,
  but weekly/monthly report generation and report notifications do not exist yet.
- Wellness is optional, account-scoped, device-local, and retained for seven
  Cairo dates. A server report has no source for a wellness history. Missing or
  expired entries cannot be inferred as skipped, healthy, or compliant, and a
  reporting feature must not silently upload health/checklist data.
- The settings screen's Download icon opens PWA installation; it is not a data
  or report export. File searches found no driver report export implementation.

## Required next implementation

Add understandable Arabic/English automatic reports for completed Cairo weeks and
months, with recorded trip/income/expense/fuel/distance/work-time totals; income
per hour and kilometre where measurable; platform distribution; recorded vehicle
and maintenance costs; and prior-period comparisons. Monthly reports also need
daily/weekly trends, largest recorded expenses, and factual best/worst observations
with their sample counts and cost basis. No-data periods and unknown gross values
must remain explicit.

Define saved report identity, capture time, period boundaries, revision behavior
after source corrections, and owner-scoped history before implementing delivery.
Automatic generation must be bounded, retryable, and deduplicated across API
instances. Report delivery needs its own implemented preference choices and must
respect quiet hours without sending a catch-up flood. Do not label an existing
live analytics card as an automatic report.

Show only available local wellness evidence with a clear device/retention label,
or explain its absence. Any future server wellness storage requires a separately
considered product/privacy decision; it is not a dependency blocking financial
reports. Provide clear loading, empty, offline, conflict, and retry states.

## Acceptance to establish

Use PostgreSQL tests for Cairo ISO-week/year and month/DST boundaries, source
corrections, linked-cost deduplication, missing gross/denominators, negative income,
cross-owner access, complete counts over multiple pages, concurrent generation,
rollback, and scheduled preference changes. Browser tests should cover previous
period navigation, lost responses, report delivery/opening, Arabic/English,
mobile accessibility, offline saved views, and honest wellness availability.
Include representative production-scale measurements and record remaining limits.

Maintenance/oil-change, inspection/license, spending and productivity notification
producers, browser push, browser sync consumption, representative OCR acceptance,
and all other outstanding master requirements remain in scope alongside reporting.
