# Work-session capture checkpoint — 17 September 2026

Implementation under master sections 11, 13–15, 17, 19, 21, 23–26 and 28–33.
The complete 35-section goal remains active. This is local worktree evidence,
not a production deployment or a claim that all reporting/wellness work is done.

## Driver behavior

Drivers can start/end overall work, add a missed period, correct recorded times,
delete/restore mistakes, and review paged history in Arabic or English. The
dashboard's recorded-hours link and navigation reach `/work-sessions`. Forms
show Cairo time, preserve original instants, handle repeated clock times, and
reject invalid/future/excessive intervals. Missed periods have blank time fields.
Long-abandoned open sessions require actual end-time review or cancellation.

Each pending action retains its original times, reviewed version and identity
before HTTP submission. Reload/lost responses use the account-scoped draft flow.
The page reads current state and acts on the displayed version; it does not make
an extra state request that delays or loses the intended timestamp. An unavailable
state read remains visibly unconfirmed and can still lead to a pending start,
or an end for the last displayed session. The server resolves conflicts when the
driver retries. Nothing automatically submits when connectivity returns.

Delete/restore confirmation includes the actual times and reviewed version.
Shared dialogs now honor reduced-motion preferences. The settled Arabic history
dialog was visually inspected at 320px; the first screenshot was captured during
its opening transition and was replaced with a settled-state check.

## Integrity and architecture

[ADR-0014](../adr/0014-recorded-work-sessions.md) records the decisions. New overall
work has no invented platform attribution. Existing platform sessions retain
their meaning and FK restriction. Total recorded time unions overlapping trips
and completed non-deleted sessions, while platform totals use only that platform's
records. Open sessions do not inflate reported hours.

All mutations use durable receipts, version checks where applicable, append-only
revision writes and projection updates in one transaction under the existing
driver lock. Replay returns the current record. Soft deletion/restoration and
one-open-session races preserve financial totals. The open response now explicitly
contains a nullable session; list/history use bounded owner/filter-scoped paging.
The downstream recommendation reader also excludes deleted trips/sessions and
uses the same interval union clipped to rolling day/week windows. Overlapping
platform/overall time cannot inflate its recorded-work input.
The coordinated unpublished contract-2 release includes the four existing session
operations; six newly catalogued operations support the completed workflow.

The implementation follows existing React/Nest/Prisma boundaries, shared schemas,
strict request interfaces, enums, companion controls, localized strings and the
existing IndexedDB recovery mechanism. No dependency or framework was added.

## Files created or changed

- `packages/shared-types/src/work-session.ts`, `index.ts`: enums.
- `packages/api-contracts/src/domains/work-sessions.ts`, `work-sessions.spec.ts`,
  `operations.ts`, `sync-pull.ts`, `sync-push.spec.ts`, `catalog/release.ts`, and
  `core/errors.ts`: request/response contracts, paging, reviewed versions, errors,
  operation registration and release metadata.
- `apps/api/prisma/schema.prisma` and migration
  `20260922000000_work_session_capture/migration.sql`: nullable attribution,
  versions, soft deletion, scoped open-session constraint, paging and revisions.
- `apps/api/src/modules/sessions/sessions.service.ts`, `sessions.controller.ts`,
  `session-queries.ts`, `session-validation.ts`, `session-history.ts`: domain
  execution, typed delivery, queries, validation and revision snapshots.
- `apps/api/src/common/authorization/driver-ownership.ts`,
  `common/operations/mutation-receipt.ts`, aggregate model/service and sync
  query/result mappers: nullable references, shared receipt kinds, attribution
  and current deletion/version state.
- `apps/api/src/modules/recommendations/recorded-workload.ts` and
  `recommendations.service.ts`: corrected downstream work-time inputs. The
  existing fatigue model is a separate open finding in the wellness audit.
- `apps/web/src/pages/work-sessions/`: API adapter, controls, editor, list/history,
  and browser unit checks. `lib/record-drafts/record-draft.model.ts` adds the kind.
- Driver router, dashboard, sidebar control, shared dialog, AR/EN dictionaries
  and admin dictionary: discoverability, labels, motion and governed messages.
- `apps/api/scripts/verify-work-sessions.ts`, `test-integration.ts`,
  `verify-sync-push.ts`, `verify-cairo-calendar.ts`, `verify-aggregate-integrity.ts`,
  `verify-driver-isolation.ts`, `smoke.ts`: new real-data evidence and reviewed
  identities/versions in existing callers. The autumn Cairo fixture uses a past
  25-hour day so future-work validation remains enforced.
- `apps/web/tests/browser-integration/work-sessions.spec.ts`,
  `scripts/contracts/catalog-data.mjs`, and `scripts/verification/verify.mjs`:
  browser journeys, 188-route inventory and mandatory work-session check.
- ADR-0014, this checkpoint, capture audit and engineering roadmap: design,
  evidence and remaining master scope.
  `wellness-notification-audit.md` records the inspected follow-up requirements.

## Verification

- Standalone database integration passed all 24 checks in
  `verification-output/work-session-integration-1.log`. Work-session write p95
  was 17.26 ms over 20 local committed writes with receipts/history/projections.
  This is a regression measurement, not production traffic evidence.
- Shared tests passed: 58 value-type tests and 84 contract tests. All 60 driver
  unit tests and 661 supplementary checks passed.
- Final root `2026-09-17T07-11-59-441Z-28516` passed, completing at
  `2026-09-17T07:19:51.632Z`. It includes the downstream recommendation-reader
  correction and its database cases: deleted trips/sessions, combined interval
  union, rolling-window clipping and owner isolation.
- All 24 PostgreSQL checks, 46 HTTP smoke checks, and 49 browser cases passed
  (18 intercepted and 31 real API/database). Browser failures, skips and flakes
  were zero. The five new journeys include lost start/end replies, reload,
  corrections/deletion/restoration/history, stale versions, abandoned sessions,
  storage failure, and an offline start with explicit retry. Keyboard/focus,
  reduced motion and settled Arabic history at 320px were checked.
- Lint, all application type checks, API/shared unit suites, API/web/admin
  production builds, contracts/catalog/OpenAPI, dependency boundaries, route/ADR
  audits, 78 artifact measurements and security scanning passed. The new lazy
  route chunk is 6,524 compressed bytes against its 153,600-byte route budget;
  this excludes its shared dependencies.
- Evidence: `verification-output/baseline-report.json`,
  `verification-output/runs/2026-09-17T07-11-59-441Z-28516/`, and
  `verification-output/work-session-root-verify-2.log`. The report remains
  diagnostic (`authoritative=false`) for this uncommitted shared worktree.

## Remaining master work

This adds driver work capture; it does not implement generic browser sync or
configurable wellness reminders. Overall hours are driver-recorded intervals,
not platform telemetry or a health assessment. The broader reporting, wellness,
notification, OCR acceptance and full-product audit requirements remain active.
