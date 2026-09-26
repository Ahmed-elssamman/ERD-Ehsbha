# Maintenance cash accounting checkpoint

17 September 2026. Implements the recorded-service-cost portion of the open
maintenance/fuel audit. The full master goal remains active.

## Driver behavior

Service records now support create, edit, paged history, archive and restore.
Each correction requires the version opened by the driver; a stale form retains
its input. A failed/unconfirmed save keeps its retry key and freezes editable
fields until the result can be retried. Closing the form clears its draft;
the copy tells the driver to check the records before re-entering it. No claim
of persisted offline maintenance drafts is made.

Cost entry starts blank, accepts explicit zero and rejects fractional piastres.
Dates use Cairo time with daylight-saving fold selection and unchanged-instant
preservation. The selected vehicle supplies a visible odometer default, not a
fabricated service history. Catalog choices filter by vehicle applicability.

Explicit expense search looks within seven days of the chosen date, requires
matching cost and restricts results to Other expenses for the selected vehicle
or no vehicle. Linked sources retain their values; edits that disagree require
unlinking. Deleting either source preserves the other. See ADR-0008 for date
and accounting rules. List pages have 25 records by default and at most 100;
record and history cursors bind owner, vehicle, operation and applicable filters.

Daily, weekly and monthly reports show fuel, expenses, service costs outside
expenses and any retained historical maintenance estimate separately. Goals,
forecasts, today's score, newly generated decisions/digests and admin totals
read the same rebuilt operating income. Historical score snapshots and previously
delivered notifications remain historical; they are not rewritten. Financial
writes expire cached recommendations within the source transaction.

## History and guidance

Financial history retains before/after item, vehicle, date, odometer, cost,
expense link, archive state and version. It excludes notes. Revisions are
append-only in application code, not immutable against privileged database
administrators. Account deletion cascades through these records.

Missing service history, future service evidence and an odometer below the
last service reading do not produce a healthy/overdue claim. Unknown values
remain null. Latest records use one grouped SQL query with deterministic ties;
future records do not drive today's guidance. Known ratios render as percentages.
Catalog intervals are explicitly generic; advice asks the driver to check the
vehicle handbook. They are not manufacturer-approved schedules or inspections.

## Files and verification

- Prisma schema and `20260917220000_maintenance_cash_integrity` migration:
  archive/version/retry fields, owner and active-link constraints, revision
  history, maintenance totals and projection version.
- API maintenance controller/services, link/history helpers and shared record
  cursor; expense link validation and source-date refresh; aggregates, analytics,
  recommendation guidance and repair CLI.
- Shared maintenance enums/snapshots, maintenance contracts, report fields,
  error registry and exact major-2 release manifest; regenerated catalog/OpenAPI.
- Driver maintenance page plus record, link, history, status and guidance
  components; shared operating-cost summary; expense cross-link display;
  AR/EN copy and admin reporting compatibility.
- `verify-maintenance-integrity.ts`: real PostgreSQL ownership, distinct equal
  payments, date/week/month moves, links, retries, concurrency, version conflicts,
  deletion/restoration, notes privacy, source/projection rollback, legacy cutover,
  tied-date pagination over 1,003 rows and local read latency.
- Maintenance contract, engine and form units; real API browser journeys for
  paging, lost responses, stale edits, history, Arabic 320px recovery and HTTP
  retry scope.

Root run `2026-09-17T03-05-54-482Z-23244` passed. Log:
`verification-output/maintenance-root-verify-1.log`. It includes all migrations,
19 PostgreSQL integration checks, API units, 125 package tests, smoke, contracts,
boundaries, all three production builds, route audit, security and 73 artifact
measurements. All 27 browser cases passed without skips or flakes: 18 intercepted
API cases and nine real API/DB cases, including the three new maintenance cases.
Cloud OCR remains substituted by the recognition fixture in those OCR journeys.

Separately, 276 API unit tests, 48 driver unit tests, 12 admin unit tests and
617 supplementary verification checks passed. A final AR/EN wording clarification
made the active-expense date rule explicit after the root run; the subsequent
driver production build and artifact measurement passed
(`maintenance-final-copy-build.log`, `maintenance-final-measure.log`). No business
logic changed after the successful root run.

The initial focused PostgreSQL run passed at 6.98 ms p95 for list plus risk reads
over 1,000+ records (20 local samples). This is not a production-load or network
benchmark. The full integration run also checks the read budget. The disposable
PostgreSQL instance is stopped at the checkpoint; production data was not changed.

New files are `packages/shared-types/src/maintenance.ts`,
`packages/api-contracts/src/domains/maintenance-records.ts` and its spec,
`apps/api/src/common/pagination/record-cursor.ts` (moved from expenses),
`apps/api/src/modules/maintenance/maintenance-queries.service.ts`,
`maintenance-links.ts`, `maintenance-history.ts`,
`apps/api/src/modules/analytics/engines/maintenance-guide.control.ts`,
`apps/api/scripts/verify-maintenance-integrity.ts`,
`apps/web/src/components/operating-cost-summary.tsx`, and the maintenance page's
`maintenance.control.ts`/spec, `maintenance-record-dialog.tsx`,
`maintenance-link-picker.tsx`, `maintenance-status-dialog.tsx`,
`maintenance-history.tsx`, `maintenance-risk.tsx`, plus
`apps/web/tests/browser-integration/maintenance-journey.spec.ts`.
Modified integration points are the Prisma schema/migration, maintenance
service/controller/module, expense service, aggregate calculation/model/control/
repair/service, profit and recommendation engines, analytics/admin serializers,
driver API adapter, vehicle selector, analytics/expense pages and error display,
both locale dictionaries, shared exports/contracts/release manifest, generated
catalog artifacts, integration runner and root required-evidence list. The
maintenance page itself was split into the components listed above.

## Open work

Per-vehicle confirmed schedules/provenance, fuel purchase corrections and
efficiency evidence, missing vehicle-cost assumptions, persisted financial
drafts, wider report/wellness/admin flows and other master requirements remain
open. This checkpoint does not certify maintenance/fuel as a complete feature
or replace the final 35-section acceptance audit.
