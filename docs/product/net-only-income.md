# Take-home-only trip income

Implementation and validation, 17 September 2026. All 35 master sections remain in scope.

Manual entry and OCR review support fare/commission breakdown or total take-home
income. The latter is after platform deductions, includes tips, and precedes the
driver's operating expenses. Gross and commission remain null when unknown.
The configured platform rate never supplies a guessed fee. Blank and zero differ.

`earningsPiastres` is a nullable PostgreSQL bigint exposed as integer JSON money.
Application writes persist resolved income. Historical complete rows can resolve
it from recorded gross, commission and tips. `receivedPiastres` retains its
meaning: fare after commission, before tips. The shared resolver validates the
equation and derives missing facts only when arithmetic establishes them.

Example: 85 EGP take-home including a 5 EGP tip stores earnings 8500 and received
fare 8000, with gross and commission null. Adding gross 100 EGP establishes
commission 20 EGP without adding the tip twice. On net-only records, changing the
included-tip breakdown preserves total earnings. On complete fare records,
changing an additional tip changes earnings.

All five aggregate families retain known gross subtotals and counts of trips
with gross/commission facts. Public gross is null unless every trip has that
fact; known subtotals and counts are exposed separately. Driver and admin reports
explain incomplete gross. Trip lists/details still show take-home income. Net
uses every trip's income and the existing recorded-cost calculation. This does
not establish complete cost coverage or allocate unlinked expenses.

OCR review does not reinterpret a generic received/receipt amount as a
tips-inclusive total. Drivers explicitly enter take-home income when the provider
has not supplied that fact. Extracted values remain in source history. Receipt
snapshots omit earnings when absent, preserving historical complete-confirmation
hashes. Net-only receipts retain the explicit amount through retry, later edits,
deletion and repeated imports. Absent earnings are not counted as a correction.

HTTP retry storage preserves ISO dates and safely serializes bigint money and
Prisma decimal values. Previously, dates became empty objects during
canonicalization, so date-only changes could hash identically and replayed dates
were malformed. Exact replay and date-only key conflicts are now tested.
Integers outside safe JSON precision are rejected instead of rounded.

## Migration and release

`20260917160000_trip_financial_evidence` makes gross/commission nullable, removes
the commission default, adds earnings and completeness counters, backfills
recorded values, and checks sufficient evidence and consistent known income.
Historical numeric zero remains known zero. Only disposable PostgreSQL databases
have been migrated.

Before production migration, inspect historical records for negative money,
commission above gross, or received fare inconsistent with gross minus commission.
Investigate source evidence and retain a correction trail instead of normalizing
questionable history automatically. Back up and rehearse migration and restoration.

Nullable responses and removal of implicit zero commission are incompatible with
the previous checkout. They belong to the initial coordinated API/web/admin
contract cutover in the foundation plan. Do not deploy this backend independently
to older clients. If the previous contract has already been published, a major
contract release and old-client rejection/update path are required first. Current
catalog compatibility labels describe the initial foundation baseline, not a
certified upgrade path from a deployed financial contract. No deployment or
production compatibility is claimed here.

Do not reverse the migration by replacing missing amounts with zero. Once
net-only records exist, older code cannot represent them. Roll forward with
compatible API and clients, or restore a consistent pre-release backup under an
explicit data-recovery plan. Old HTTP retry entries whose hashes omitted dates
fail closed after the correction: review the saved result before using a new key.
OCR confirmation hashes preserve their prior layout.

## Changed-file inventory

- Shared domain: `packages/shared-types/src/trip-finance.ts`, its tests and export.
- Shared contracts: trip/OCR schemas, new financial-coverage model, analytics/admin
  schemas, error registry, tests and exports; regenerated contract artifacts.
- Prisma schema and financial-evidence migration.
- API trip writer; aggregate model/control/calculation/coverage/service;
  driver/admin analytics and trip readers; daily digest and recommendation context;
  OCR confirmation mapper/service; HTTP retry serialization and tests.
- Driver manual form/control/tests, OCR review controls/state/mapping/tests,
  coverage notice, trip readers, analytics, API types, formatting and AR/EN messages.
- Admin amount controls, coverage notice, trip/driver readers, analytics,
  formatting and translations.
- PostgreSQL financial-evidence/confirmation/isolation harnesses, integration
  runner, root evidence requirement, and real/mocked browser journeys.

## Verification

Focused checks passed: all three application type checks, 35 web unit tests,
104 shared-package tests, 597 supplementary checks, lint, PostgreSQL financial
evidence and regression harnesses, and both real API/database browser journeys.
The browser tests cover complete OCR fares, manual/OCR take-home capture,
included-tip edits, durable review, saved receipts, exact HTTP replay, date-only
retry conflicts and Arabic RTL at 360px. Recognition uses a controlled provider
fixture and is not evidence of cloud extraction accuracy.

Full root run `2026-09-17T01-15-19-823Z-22804` passed; its log is
`verification-output/net-income-root-verify-2.log`. It includes clean migrations,
database checks, 41 smoke checks, all 19 browser tests (17 intercepted and two
real API/database journeys), production builds, contracts, boundaries, route
audit, artifact measurements and security. No browser tests skipped or flaked.
The extended browser journey also verifies report completeness, mode switching
without losing entries, and later enrichment without changing take-home income.
Reports are diagnostic on the inherited dirty worktree, not release certification.

The first run found a uniqueness-test fixture with insufficient
financial evidence. It now supplies the commission implied by its fare/received
amounts; constraints and assertions remain enforced. Focused isolation, OCR
confirmation and reconciliation harnesses then passed.

Cairo business days are covered by the subsequent `cairo-reporting-calendar.md`
implementation. Still in scope: cost linking/coverage, manual correction
history, maintenance/fuel models, provider earnings semantics, representative
OCR acceptance data and every other unfinished master requirement. This
checkpoint does not establish full financial correctness or production readiness.
