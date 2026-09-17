# Manual trip recovery and correction integrity — 17 September 2026

This checkpoint addresses the findings in `manual-trip-recovery-audit.md`. The
35-section master goal remains active. This is local worktree evidence, not a
production deployment or a final production-readiness audit.

## Behavior and architecture

- Manual trip creation and correction use account-scoped IndexedDB drafts.
  Incomplete inputs survive navigation/reload. Pending submissions retain their
  body and identity before HTTP; fields and automatic commission calculations
  remain frozen until the result is known. A successful response's trip ID is
  retained while local cleanup retries, without another HTTP write. Automatic
  defaults do not create an unfinished draft before the first user edit. Validate
  the canonical request against the shared trip contract before marking it
  pending, so out-of-range values stay editable without a network submission.
- The trip list can resume old drafts independently of its date filter or loaded
  page. Storage failure is explicit and does not hide screenshot capture.
  Existing account changes, logout cleanup, stale-tab rejection and unreadable
  draft handling use the shared protocol from ADR-0010.
- Trip corrections, deletion and restoration require a reviewed positive
  version. Driver and admin writers use the existing driver locks. Each change
  appends financial before/after history in the same transaction as the record,
  version and aggregate changes; admin audit records join that transaction.
  Admin batches reject stale targets atomically. Driver batches retain partial
  results and keep failed selections at their original versions.
- Creation origin is stamped by the server. Historical origin stays unconfirmed
  unless an existing OCR confirmation proves it. History excludes private
  notes and locations. Existing OCR receipts remain authoritative after edits
  or deletion and do not create replacement trips.
- Drivers can view deleted trips, restore them and inspect paged history.
  Listing cursors include start time and ID and are scoped to the owner and
  filters. History cursors are scoped to the owner and trip. Trip detail refreshes
  on entry before enabling correction or status actions; a conflict refreshes
  the displayed record while preserving the open confirmation's reviewed version.
- Both browser applications send version targets and stable retry identities.
  Update/restore fingerprints include the resource ID; delete fingerprints also
  include the expected-version query. The unpublished major-2 manifest includes
  the eleven affected existing operations, alongside two new trip operations.
- AR/EN messages explain pending saves, conflicts, storage errors and recovery.
  Visual inspection also found incorrect history translation keys in fuel and
  maintenance; those callers now use the existing translated history labels.
- Deferred initial dialog focus now preserves a field the driver has already
  focused, avoiding interruption of early typing. The shared draft hook accepts
  an optional persistence guard for the trip form's automatic defaults; existing
  operating-record editors keep their existing autosave behavior.

ADR-0011 records the decision. The existing React/Nest architecture, shared
financial calculations, integer money, Cairo calendar, ownership boundaries and
strict companion models/control files are preserved. No dependencies were added.

## Changed files

New files:

- `packages/shared-types/src/trip-record.ts`
- `packages/api-contracts/src/domains/trip-records.ts`
- `packages/api-contracts/src/domains/trip-records.spec.ts`
- `apps/api/prisma/migrations/20260919000000_trip_integrity/migration.sql`
- `apps/api/src/modules/trips/trip-history.ts`, `trip-queries.ts`, `trip-errors.ts`
- `apps/api/scripts/verify-trip-integrity.ts`
- `apps/web/src/pages/trips/trip-draft.control.ts`, `trip-history.control.ts`,
  `trip-history.tsx`, `trip-status-dialog.tsx`
- `apps/web/tests/browser-integration/trip-drafts.spec.ts`
- `docs/adr/0011-trip-drafts-and-corrections.md` and this checkpoint
- `docs/product/sync-correctness-audit.md` (read-only follow-up findings)

Updated files:

- Shared types index; contract trip/OCR, admin core/operations, error registry,
  release manifest and generated catalog/OpenAPI/consumer artifacts.
- Prisma schema; trip service/controller; admin bulk service/controller and trip
  reader; OCR confirmation service; sync writer.
- API integration/smoke runners and aggregate, Cairo, driver-isolation, expense,
  OCR-confirmation and trip-financial-evidence verifiers; driver/admin HTTP
  contract test fixtures.
- Driver API endpoints; shared draft model/gate/form hook and dialog focus;
  trip form and form controls,
  list and list controls, detail and new-trip pages; fuel/maintenance history
  labels; AR/EN dictionaries.
- Admin API endpoints, trip page/control and dictionary.
- Browser draft fixtures; catalog route-count configuration; root required
  integration checks; engineering roadmap and the linked audit.

## Verification

Executed before the full check:

- API, driver and admin type checks; clean lint; 283 API tests; shared package
  tests; 57 driver tests and 12 admin tests.
- PostgreSQL integration passed with the trip check added: competing corrections,
  owner isolation, source/revision rollback, source origin, archive/restore,
  immutable OCR acknowledgement, financial evidence, linked payments and Cairo
  aggregate reconciliation. Pagination traversed 1,003 identical timestamps
  without duplication or omission. Local trip-list p95 was 3.08 ms over twenty
  samples; this is not a production latency claim.
- Contract verification passed with 182 routes, 41 controllers, 101 driver
  consumers and 60 admin consumers.
- Four new real-API browser cases passed in `trip-browser-4.log`: incomplete and
  pending reload, lost-response replay, stale corrections and deletion,
  resource/query replay fingerprinting, restoration, Arabic at 320 px, screenshot
  access during storage failure, and successful-save receipt/local-cleanup retry.
  Existing manual/OCR take-home capture passed in `trip-browser-1.log`.

Final root run `2026-09-17T05-21-37-990Z-30664` passed (`trip-root-verify-3.log`),
including all 21 PostgreSQL checks, 283 API tests, shared package tests, 41 smoke
checks, 44 browser cases, all production builds, contract/boundary checks,
route/security audits and 77 artifact measurements. The 44 browser cases comprise
18 intercepted-response cases and 26 real API/database cases; none were skipped,
failed or flaky. The driver trip case also checks that defaults create no empty
draft and that an unsupported amount remains editable before submission.

The earlier full run exposed two dialog focus races. After preserving existing
field focus, the affected fuel, Arabic and manual-trip cases passed three times
each (`trip-focus-repeat-1.log`, nine cases) before the final full run. All 637
supplementary verification tests passed in `trip-supplementary-1.log`. The final
Arabic history screenshot `trip-history-ar-320.png` was visually reviewed with
translated before/after/action labels and no horizontal overflow.

Diagnostics live in ignored `verification-output`; tests and the verification
runner remain the reproducible acceptance sources. The report is diagnostic for
the inherited dirty worktree (`authoritative=false`). These local results do not
claim production traffic performance or completion of the master product audit.

## Limits and remaining master work

Browser drafts remain device-local and subject to browser eviction or clearing.
There is no automatic submission or expiry of uncertain financial requests.
Status dialogs keep versions and retry keys while mounted; they are not durable
drafts. History starts at this migration and does not invent earlier revisions.

The wider master audit is unfinished. Further work includes manual-entry effort
and remembered choices, the global sync pull cursor, vehicle-cost assumptions,
and the other outstanding product, security, reporting, wellness and operational
requirements tracked in the roadmap. No production database was accessed, no
commit was created, and nothing was deployed by this checkpoint.
