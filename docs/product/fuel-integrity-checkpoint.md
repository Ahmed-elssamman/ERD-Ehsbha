# Fuel purchase implementation checkpoint

17 September 2026. Part of the active 35-section master goal. This is an
implementation/evidence ledger, not a full product acceptance declaration.

## Changed files

- `apps/api/prisma/schema.prisma` and
  `migrations/20260918000000_fuel_integrity/migration.sql`: retained quantities and
  prices, optional measurements, fuel kind, coverage, versions, archive/history,
  owner links, shared-expense claim constraints, dated mileage provenance and
  financial projection version 3. Migration observations use explicit UTC even
  when the database session uses Cairo.
- `packages/shared-types/src/fuel.ts`, `vehicle-odometer.ts`, `index.ts`: domain
  enums, units and source snapshots. `packages/api-contracts/src/domains/`
  `fuel-records.ts` and its spec, `operations.ts`, `vehicle-app-area.ts`,
  `expense-records.ts`, `admin-core.ts`, `platform-operations.ts`, `core/errors.ts`
  and `catalog/release.ts`: executable contracts, errors and the coordinated
  unpublished major-2 manifest. Generated catalog/OpenAPI artifacts and
  `scripts/contracts/catalog-data.mjs` include 180 routes.
- `apps/api/src/modules/fuel/`: controller, module, mutation service, query
  service, response mapper, history, expense-link validation and evidence limits.
  `common/pagination/version-cursor.ts` supports scoped version-ordered history.
- `modules/vehicles/`: shared request DTOs, mileage reconciliation, guarded manual
  baseline updates and response provenance. Maintenance risk treats unknown,
  ambiguous or legacy-unconfirmed mileage as missing evidence.
- `modules/aggregates/aggregate.control.ts`, `aggregates.service.ts`,
  `modules/expenses/expenses.service.ts`, `modules/maintenance/maintenance-links.ts`
  and `maintenance-queries.service.ts`: exact recorded cash, linked-date refresh,
  cross-domain link validation and projection cutover. Related services return
  governed `NOT_FOUND` errors rather than turning a missing record into 502.
- `modules/analytics/engines/fuel.engine.ts` and its spec,
  `fuel-comparison.engine.ts`, its spec and copy control, plus
  `modules/recommendations/recommendations.service.ts`: full-to-full evidence,
  weighted measurements, null missing results and separate vehicle comparisons.
- `modules/sync/sync.service.ts`, `modules/admin/admin-vehicles.service.ts` and
  `admin-drivers.service.ts`: normalized fuel and mileage responses. This does
  not fix the separately identified global sync-cursor truncation problem.
- `apps/web/src/pages/fuel/`: reachable purchase page, form, expense picker,
  delete/restore dialog, history, evidence view, static controls and form tests.
  `router.tsx`, `components/layout/sidebar.tsx`, `lib/api/endpoints.ts`,
  `components/layout/sidebar.control.ts`, `pages/settings/vehicle-form.control.ts`,
  `lib/record-month-range.ts`, expense/maintenance controls and pages, settings,
  and both translation dictionaries integrate the workflow and cache refreshes.
- `apps/admin/src/pages/vehicles.tsx`, `driver-detail.tsx` and `i18n/dict.ts`:
  missing readings and mileage provenance are visible in administration.
- `apps/api/scripts/verify-fuel-integrity.ts`, `test-integration.ts`,
  `verify-driver-isolation.ts`, `verify-aggregate-integrity.ts`,
  `verify-cairo-calendar.ts`, `verify-maintenance-integrity.ts`, `prisma/seed.ts`,
  driver HTTP agreement tests, browser fixtures, and
  `apps/web/tests/browser-integration/fuel-journey.spec.ts`: real database,
  request contract, ownership, source/projection, browser and retry coverage.
  `scripts/verification/verify.mjs` requires fuel integration evidence.
- `docs/adr/0009-fuel-purchase-evidence.md`, `fuel-integrity-design.md` and this
  ledger record the research, accounting choices, transition and evidence limits.

## Behavior

Drivers can record only a vehicle, date and actual payment. Blank measurements
stay missing; explicit zero payment is valid. Quantity and recorded price are
independent of the receipt amount. The form shows their disagreement without
overwriting it. Gas and electric purchases have their own units and count as
spending. No fuel prices or historical fuel types are invented.

Active fuel purchases count on their Cairo date unless explicitly linked to an
active matching Other expense. Then the expense counts once on its date. Archive,
restore, corrections and expense state changes refresh all affected periods in
the same transaction. Equal amounts alone are not deduplicated. A fuel purchase
and maintenance record cannot claim the same active expense.

Fuel mutations retain financial snapshots and versions. Uncertain HTTP saves
replay with the same identity; stale edits keep the user's typed correction for
review. Lists have stable scoped cursors and a complete filtered purchase total.
History excludes notes and orders by version. Existing records without history
say so. Driver reference checks are enforced in services and owner foreign keys.

Mileage corrections retract their former contribution. A newer manual baseline
survives an older fuel edit. Legacy current mileage is preserved with unconfirmed
provenance; unknown and ambiguous readings are not displayed as zero. The settings
form accepts an explicit new reading without resaving a rounded old reading when
unrelated fields change.

Consumption requires a complete full-to-full cycle. The opening quantity/payment
is excluded; intermediate partial fills and the closing full fill are included.
Missing quantities, boundary mileage, gaps, backwards readings, equal timestamps
and incompatible liquid fuel prevent a measurement. Valid later cycles can
recover after incomplete evidence. Ratios use total distance/quantity; petrol
and diesel cycles are never averaged together. Comparisons require two cycles
in each disjoint window for the same vehicle and preserve evidence dates/counts.

## Verification

Final root gate `2026-09-17T03-52-12-964Z-23576` passed; log
`verification-output/fuel-root-verify-2.log`. It includes lint, type checking,
API unit tests, all migrations, 20 real PostgreSQL integration checks, package
builds/tests, smoke, executable contracts, dependency boundaries, all production
builds, route/security audits and 75 artifact measurements. Contract inventory:
180 routes, 41 controllers, 99 driver consumers and 60 admin consumers.

All 30 Playwright cases passed with no skips, unexpected failures or flakes:
18 intercepted cases and 12 real API/database cases (including HTTP-only checks).
The new fuel journeys cover English 360px entry, 52-row paging, an independent
receipt amount, explicit expense linking, a lost POST response and stable retry,
a stale correction retaining input, private-note exclusion from history, Arabic
320px charging with accurate fractional quantity, load-error recovery,
archive/restore, full-to-full evidence, ownership and deletion fingerprints.

Separately: 50 driver unit tests, 12 admin unit tests and 626 supplementary
verification checks passed. Final companion-control extraction also passed lint
and driver type checking before the gate's browser runs and production builds.
The report is diagnostic for this uncommitted worktree; it is not a production
release attestation.

The focused PostgreSQL verifier passed real payment links, duplicate identity,
scope isolation, cross-family database constraints, expense archive/restore,
stale writers, financial history, rollback, manual/fuel mileage preservation,
legacy projection repair and 1,003 tied-date records with complete page totals.
The local 20-sample list p95 was 7.56 ms. This is not a production-load or network
latency measurement. The final integration run also checks UTC history instants
with a Cairo database session. Only disposable test databases were changed.

## Remaining master work

The subsequent [operating-record draft checkpoint](operating-record-drafts-checkpoint.md)
adds durable create/edit drafts across reload and close for fuel, maintenance
and expenses. Complete historical manual-mileage audit, future-dated reading
activation, fuller recommendation evidence display,
manufacturer/user-confirmed schedules, vehicle cost assumptions, sync cursor
recovery and the other unfinished master sections remain in scope. OCR cloud
accuracy still requires representative real evidence; browser OCR fixtures do
not establish provider accuracy. No production data was changed or deployment
performed. No final 35-section acceptance audit has been completed.
