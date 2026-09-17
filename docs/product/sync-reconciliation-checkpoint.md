# Sync pull reconciliation checkpoint — 17 September 2026

This checkpoint covers sync **pull** correctness. The 35-section master goal
remains active. It is local worktree evidence, not a production deployment or a
claim that the browser now synchronizes its records through this API.

## Change and rationale

Replace the old global timestamp watermark, which could advance past undelivered
rows, with the explicit reconciliation protocol in
[ADR-0012](../adr/0012-sync-reconciliation.md). Pages use immutable IDs, one typed
family at a time, at most 100 records, owner-bound signed continuations, fixed
upper bounds, and a 24-hour cycle lifetime. Empty families still have continuation;
only null `nextCursor` completes the cycle. All nine original families remain.
The shared pull schema is the controller's schema through its service re-export.

The protocol converges through repeated complete scans; it is not a snapshot of
all families at one instant. Deleted records disappear from the replicated cache
only after a complete reconciliation, while financial soft deletions retain
their state/version. Concurrent changes can require the next cycle. A future
client must preserve local pending/acknowledged writes separately, stage by
account/cycle, and enforce recommendation expiry offline. Full scans trade total
bandwidth for simpler correctness; this does not justify frequent automatic
polling without workload measurements.

The implementation keeps Nest/Prisma and the existing financial mappers. New
code has explicit interfaces, shared enums and schemas, and a companion control
file. Six indexes complement the three existing owner/ID unique indexes. No
new dependency, financial table rewrite, payload-copy ledger, frontend form, or
background mutation submission was introduced.

## Files created or changed in this checkpoint

- `packages/shared-types/src/sync.ts`, `packages/shared-types/src/index.ts`:
  family/mode enums and structured JSON value types.
- `packages/api-contracts/src/domains/sync-pull.ts`, `sync-pull.spec.ts`, and
  `platform-operations.ts`: bounded requests, typed family pages, response and
  OpenAPI metadata, runtime contract tests, and operation pagination/error rules.
- `apps/api/src/modules/sync/sync.control.ts`, `sync-cursor.ts`,
  `sync-cursor.spec.ts`, `sync-queries.ts`, `sync-pull.ts`, `sync.service.ts`:
  family order, signature/lifetime checks, indexed reads, typed serialization,
  cycle continuation and delegation from the existing service.
- `apps/api/prisma/schema.prisma` and
  `apps/api/prisma/migrations/20260920000000_sync_reconciliation_indexes/migration.sql`:
  owner/ID indexes for fuel, sessions, areas, app bindings, goals and recommendations.
- `apps/api/scripts/verify-sync-reconciliation.ts`, `test-integration.ts`,
  `smoke.ts`, and `scripts/verification/verify.mjs`: PostgreSQL behavior checks,
  mandatory root evidence, and actual HTTP response parsing.
- `scripts/verification/lib/security-scan.mjs` and
  `scripts/verification/tests/sensitive-artifacts.test.mjs`: handle files removed
  during enumeration/scanning, with regression tests that retain adjacent secret
  detection and fail on filesystem errors other than missing paths.
- `docs/adr/0012-sync-reconciliation.md`, this checkpoint,
  `docs/product/sync-correctness-audit.md`, and `engineering-roadmap.md`:
  design, consistency limits, rollout, evidence and remaining work.

Generated catalog/OpenAPI artifacts are under `verification-output/contracts`.
Other inherited worktree changes were preserved.

## Verification

- Standalone PostgreSQL integration passed all 22 checks in
  `verification-output/sync-integration-2.log`. The sync check covers every family
  over multiple pages, 205 tied-timestamp trips, request replay, a removed cursor
  anchor, owner isolation, changed/deleted records, renamed platform metadata,
  recommendation dismissal/expiry, and an old-ID/old-timestamp transaction held
  open until after a complete scan. The next cycle includes that late commit.
- Local first-page p95 was 16.35 ms over 20 samples with the above small fixture.
  This is a local regression measurement, not a production load-test claim.
- Four cursor unit tests passed, including invalid/foreign/expired/tampered
  continuations and signing-key rotation. All 76 shared contract tests passed.
- The first full root run passed functional checks and builds, then its security
  scan flagged ordinary configuration/continuation expressions. Descriptive
  variable names removed those false positives without changing detection rules.
  A standalone scan then exposed a race with PostgreSQL temporary-file removal;
  the scanner now tolerates only disappeared paths and retains other failures.
- All 643 supplementary checks passed in
  `verification-output/sync-supplementary-3.log`, including the two scanner regressions.
- Full root `2026-09-17T05-55-06-525Z-17640` passed in
  `verification-output/sync-root-verify-2.log`: lint, type checking, API and shared
  package tests, all 22 PostgreSQL checks, contracts and boundaries, 41 HTTP smoke
  checks, 44 browser cases (18 intercepted and 26 against the real API/database),
  all three production builds, route/ADR/security audits, and 77 artifact
  measurements. Both browser suites had zero failures, skips and flakes.
- Final lint passed in `verification-output/sync-final-lint.log`. The report in
  `verification-output/baseline-report.json` is diagnostic (`authoritative=false`)
  because the inherited worktree is dirty. No commit or deployment was made.
  The disposable PostgreSQL instance was stopped after verification.

## Remaining work

Sync push still needs typed requests/results, governed error classification,
privacy-safe logging, and session-end replay that survives a lost response or
receipt-write crash window. These are confirmed in `sync-correctness-audit.md`.
The driver browser continues to use its dedicated OCR and record-draft APIs;
there is no sync-pull client, pruning engine, or automatic outbox introduced by
this checkpoint. The remaining master requirements need their own implementation
and acceptance evidence.
