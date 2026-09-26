# Sync push and session-end replay checkpoint — 17 September 2026

This checkpoint addresses the push findings in `sync-correctness-audit.md`.
The complete master objective remains active. No browser sync client or automatic
financial outbox is introduced by this backend/contract change.

## Behavior and architecture

[ADR-0013](../adr/0013-driver-mutation-receipts.md) records the design and tradeoffs.
Sync push has strict typed payloads for its five existing kinds, one stable
identity per command, typed results, and governed localized failure codes.
Invalid request shape is rejected before any write. Valid requests retain ordered
partial execution for domain failures, without labeling internal failures as bad
input or returning/logging private exception messages.

Each successful mutation commits its metadata receipt with the normal record,
history, mileage and aggregate writes under the existing driver lock. Replay does
not write again. It returns the current record, including later corrections or
soft deletion; hard deletion returns an applied receipt with null data. This
prevents delayed retries from recreating removed records. Metadata remains until
account deletion and contains no copied financial payloads.

Ordinary session end now requires a stable `clientMutationId` and shares the same
receipt transaction as sync. Both transports can replay each other's completed
session endings. Reusing a key for another request conflicts, as does a new
command against an already-ended session. The unpublished contract-2 manifest
includes the session-end change. Existing normal creation wrappers and their
domain calculations are retained; transaction-aware methods let sync include the
receipt atomically. New code uses shared schemas, enums and interfaces within the
existing Nest/Prisma architecture.

The guarantee applies to commands acknowledged by the new ledger. It cannot
reconstruct a request for a record hard-deleted before this migration. Existing
creation identities are adopted through their existing duplicate checks rather
than inventing historical request hashes.

## Files created or changed

- `packages/shared-types/src/sync.ts`: mutation kind/status enums.
- `packages/api-contracts/src/domains/sync-push.ts`, `sync-push.spec.ts`,
  `platform-operations.ts`, `operations.ts`, `core/errors.ts`, and
  `catalog/release.ts`: typed request/results, required session-end identity,
  governed session errors, and coordinated-release metadata.
- `apps/api/prisma/schema.prisma` and
  `apps/api/prisma/migrations/20260921000000_driver_mutation_receipts/migration.sql`:
  metadata-only receipts with account cascade and UTC instants.
- `apps/api/src/common/operations/mutation-receipt.ts` and
  `apps/api/src/modules/sync/sync.service.ts`, `sync-results.ts`, `sync-errors.ts`,
  `sync-errors.spec.ts`: receipt hashing/lookup, atomic execution, current-record
  responses, and privacy-safe failure classification.
- `apps/api/src/modules/fuel/fuel.service.ts`,
  `apps/api/src/modules/expenses/expenses.service.ts`, and
  `apps/api/src/modules/sessions/sessions.service.ts`: reusable transaction entry
  points and recoverable ordinary session endings.
- `apps/web/src/i18n/en.json`, `ar.json`, and `apps/admin/src/i18n/dict.ts`:
  session conflict guidance in both languages.
- `apps/api/scripts/verify-sync-push.ts`, `test-integration.ts`, `smoke.ts`,
  `verify-driver-isolation.ts`, `verify-aggregate-integrity.ts`,
  `verify-cairo-calendar.ts`, and `scripts/verification/verify.mjs`: new receipt
  evidence, transport smoke coverage, updated reviewed session identities, and
  the mandatory root integration check.
- ADR-0013, this checkpoint, `sync-correctness-audit.md`, and
  `engineering-roadmap.md`: rationale, rollout, evidence, and remaining work.
  `work-session-capture-audit.md` records the inspected missing driver workflow
  and the distinction between overall shifts and app-attributed sessions.

## Verification

- Standalone PostgreSQL integration passed all 23 checks in
  `verification-output/sync-push-integration-2.log`. This included all mutation
  kinds, concurrent retries, replay after correction/deletion, independent
  accounts using the same identity, partial owner failures, ordinary session-end
  interoperability, metadata-only receipts, account deletion, and receipt-failure
  rollback of records/history/mileage/aggregates.
- Local single-expense sync write p95 was 22.26 ms across 20 committed writes,
  including receipts and projection updates. This is a local regression check,
  not a production or 50-item batch load test.
- All 80 shared contract tests and five focused error-classification unit tests
  passed, including existing database/adapter connectivity classification and
  producer schema failures. Invalid stored/produced records return a contract
  failure rather than blaming the submitted input; private schema values stay
  out of responses.
  Final lint passed in `sync-push-final-lint.log`; API type checking passed, and
  the catalog/OpenAPI regenerated. All 647 supplementary checks passed.
- Final root run `2026-09-17T06-31-26-098Z-29692` passed, completing at
  `2026-09-17T06:39:17.797Z`. It includes lint/type checking, all API/shared unit
  tests, 23 PostgreSQL checks with the strengthened after-insert failure trigger,
  46 real HTTP smoke checks, 18 intercepted browser cases and 26 real API/database
  browser cases. The browser suites had no failures, skips or flakes.
- API/web/admin production builds, contract/catalog/OpenAPI verification,
  dependency boundaries, route and ADR checks, 77 current artifact measurements,
  and the security scan all passed. See `verification-output/baseline-report.json`,
  `verification-output/runs/2026-09-17T06-31-26-098Z-29692/`, and
  `verification-output/sync-push-root-verify-2.log`. The report is diagnostic
  (`authoritative=false`) because the shared worktree contains uncommitted changes.

## Remaining master work

The browser still uses dedicated OCR/record-draft APIs and has no sync consumer
or work-session transport flow. Session capture UX, broader offline replication,
and the other master requirements need their own current-state acceptance
evidence. This checkpoint is not a production-readiness claim or deployment.
