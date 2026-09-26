# Expense integrity

17 September 2026. Implementation under master sections 11, 21, 23, 24, 25,
26 and 29. This is a bounded financial checkpoint; it does not establish that
the full product goal or the maintenance/fuel accounting policy is complete.

## Accounting rules

An expense and a trip fee are separate costs until the driver explicitly links
them. Amount/date similarity never removes either record. Only toll and parking
fees can be linked. The fee must be positive and equal to the expense, both
records must belong to the driver, and a specified expense vehicle must match
the trip vehicle. Each trip/category has at most one active expense link.

For daily, weekly and monthly operating totals, the expense supplies the amount
and Cairo reporting date. An active link suppresses that fee on the trip. Both
source records retain their recorded values. For example, a September 30 trip
with EGP 12.34 toll and an October 5 expense for the same payment contribute
EGP 24.68 before linking and EGP 12.34 on October 5 after linking. Unlinking
restores the two separate contributions; it does not erase either source.

Linked amounts, categories and vehicles cannot silently diverge. Unlink, correct
the relevant record, and explicitly relink after checking the facts. Moving an
expense or trip refreshes its old/new dates and relevant linked trip dates, then
all dependent period projections under the driver write lock.

Deleting an expense archives it. Its linked fee counts again on an active trip;
restoration suppresses it again. A recorded expense remains a cost when its trip
is deleted. Driver trip deletion now archives the trip, preserving referenced
source facts and allowing the existing authorized admin restoration flow.
OCR receipts inspect the trip's deletion state, so replay never recreates a
deleted imported trip. Full account deletion still cascades through expenses,
trips and financial history; this was verified on PostgreSQL.

Platform, area and time-of-day comparisons show take-home income including tips
minus recorded trip tolls and parking. They do not allocate fuel, maintenance or
other operating costs. Comparison fees stay on the trip's date even when an
expense is linked on another date. These are contribution figures, not operating
net income. Existing numeric field names remain for transport compatibility;
`costBasis` states their basis and both languages explain the distinction. Hour
comparisons now deduct recorded trip fees consistently with platform/area views.

## Editing, history and recovery

Expense edits, deletion and restoration require `expectedVersion`. Each accepted
change increments the version and appends before/after financial snapshots in
the same transaction as the source and aggregates. A stale form cannot overwrite
a newer record. Existing expenses begin at version 1; earlier history is not
invented. The first correction captures the prior state. Snapshots exclude notes.
There is no public API for modifying a revision. General manual-trip correction
history beyond OCR source receipts remains separate work.

HTTP writes require `Idempotency-Key`. The fingerprint for edits/restoration
includes the resource ID and payload; deletion also includes the query version.
Reusing a key for a different record or version fails. Existing create-request
hash layouts are preserved. Successful bodyless writes store an empty-success
result for replay. The browser retains a retry key and unchanged entries when a
network/server failure leaves the save outcome uncertain. A subsequent retry
recovers the first result. Definite conflicts retain the form for review.

The form mounts on opening so its default time is current. Editing preserves an
unchanged recorded Cairo instant, including its repeated-hour occurrence and
milliseconds. Money requires whole piastres within the database integer range.
Recurring is a label; it does not schedule future expenses automatically.

## Complete totals and paging

`GET /expenses/summary` groups every active expense in an explicit inclusive
Cairo date-label range. Totals and category counts are independent of loaded
list pages and of the active/deleted view. The UI describes the scope; other
financial report inputs are not silently included in this expense-only total.

`GET /expenses` uses a default page of 25, capped at 100, ordered by date and ID.
Its opaque cursor carries a timestamp/ID position and a hash binding the owner,
filters and view. It does not look up a cursor record, so deleting that record
does not hide the next page. The cursor is not a security credential or signed
token; every query independently filters by authenticated owner. Changing data
between requests is not a snapshot transaction: refresh to review concurrent
edits or newly added records.

History uses the same bounded position approach. Matching trip fees are paged,
owned, active, unlinked and within seven Cairo dates of the chosen search date.
The search never selects a link automatically. Summary/list/history/search
failures each have a retry path. A failed total is not displayed as zero. The
month selector supports older records, and Refresh records bypasses fresh cache.

Prisma v6's pagination documentation was checked for cursor and filtering
behavior: <https://github.com/prisma/web/blob/main/apps/docs/content/docs/orm/v6/prisma-client/queries/pagination.mdx>.
This implementation uses explicit position predicates to retain paging after a
cursor record is deleted rather than depending on a record lookup.

## Changed files

- Shared: `shared-types/src/expense.ts`, `trip-finance.ts`, exports and tests;
  `api-contracts/src/domains/expense-records.ts`, operations exports,
  analytics contracts, governed errors, semantic version/envelope/parser,
  release manifest, tests and generated catalog/OpenAPI.
- Database: `apps/api/prisma/schema.prisma` and migration
  `20260917200000_expense_integrity` (links, versions, deletion state, history,
  owner foreign key, active-link uniqueness and page index).
- API: expense controller/service and cursor/link/history helpers; aggregate
  calculation, selection and repair query; trip deletion/update validation;
  analytics comparison basis; idempotency decorator/interceptor; OCR receipt
  mapper/readers. Driver/aggregate/OCR verification fixtures were updated to
  assert versions and archived source behavior.
- Web: expense page/control, form, fee picker, history and status dialogs;
  endpoint contracts; trip conflict copy; comparison charts; Arabic/English
  dictionaries and browser/unit tests. Account query persistence is versioned;
  OCR review marks draft changes pending before painting a saved indicator.
  Admin has the linked-fee error copy and updated contract fixtures.
- Verification: `verify-expense-integrity.ts`, integration registration,
  required root evidence, catalog route count and compatibility/version fixtures.
  ADR-0007 and the coordinated release runbook describe the major transition.
  Unrelated inherited changes in the working tree are not part of this checkpoint.

## Verification and release

Focused PostgreSQL verification passed on the disposable local database. It
covers equal-valued distinct costs, explicit cross-date links, ownership,
database constraints, stale versions, deletion/restoration, source preservation,
history privacy, competing links, rollback and 1,003 tied-date expense rows.
The first local 20-sample summary-plus-page measurement over 1,002 active records
had p95 4.92 ms. This excludes HTTP/network latency and is not production-load
evidence. Browser coverage includes a complete 53-record month, a dropped save
response, stale editing, Arabic RTL at 320px, history, deletion/restoration and
resource/version-bound retries. Full repository evidence is recorded after the
final verification run below.

This requires a coordinated API/driver-client release: list response shape,
required mutation versions and expense idempotency headers change together.
Contract major 2.0.0 identifies this cutover, with an exact breaking-operation
manifest and rejection tests for old/future majors. Both browser clients must
update with the API. Driver query persistence uses the contract version as its
cache marker so old financial response shapes are not hydrated into the new UI.
See ADR-0007 for the version decision; the HTTP route namespace remains `/api/v1`.
Before production migration, identify any legacy nonpositive expense amounts;
resolve them with the owner rather than silently changing financial facts. Test
the migration, backup and restore procedures against a production-like copy.
The migration does not create links or invented historical revisions.

Rollback after links or archived expenses exist requires a compatible API build
that understands them. An older writer would double count linked fees and may
count archived expenses; rolling back only browser assets is also incompatible
with required versions. Preserve the new data and deploy a compatible repair,
or restore the coordinated backup after reviewing writes since that backup.
No production database or deployment was changed during this work.

### Final checkpoint evidence

Full root run `2026-09-17T02-34-07-184Z-17396` passed, log
`verification-output/expense-root-verify-2.log`. The root gate passed lint, all
three application type checks, API units, clean migrations/seeding, all 18
PostgreSQL integration checks, 122 shared-package tests, contract coverage,
boundaries, smoke, production builds, route audit, 73 artifact measurements,
ADR validation and security scanning. All 24 Playwright tests passed without
skips or flakes: 18 intercepted regressions and six real API/PostgreSQL cases.
Cloud OCR recognition remains a deterministic test provider.

Separately, 46 driver web units, 12 admin units and 606 supplementary verification
checks passed under contract major 2. Tests detected and drove fixes to OCR
receipt deletion state, bodyless idempotency replay, compatibility versioning
and the review selection/save-indicator race. Assertions were retained. The
working tree contains inherited changes, so generated reports remain diagnostic
(`authoritative=false`); no commit, deployment or production repair was made.

Next financial work is described in `maintenance-fuel-integrity-audit.md`.
The remaining master sections continue to require implementation and validation.
