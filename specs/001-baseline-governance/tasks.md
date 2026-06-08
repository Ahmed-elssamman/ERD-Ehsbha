# Tasks: Baseline, Governance, and Repository Truth

**Input**: Design documents from `specs/001-baseline-governance/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`,
`quickstart.md`

**Implementation audience**: Tasks are intentionally small and explicit so a lower-capability
implementation model can execute them sequentially. Do not combine tasks unless they modify the
same file and the earlier task is already complete.

**Tests**: Tests are mandatory because this feature establishes the repository quality baseline.
Write or update the named test before changing the corresponding implementation whenever a task
says "test first".

**Scope guard**: Do not implement Phase 1 shared-contract migration, authentication redesign,
offline synchronization, billing, broad observability, or new product features. Record such
findings as known gaps.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: May run in parallel because it uses different files and has no dependency on an
  incomplete task in the same phase.
- **[Story]**: User story traceability label.
- Every task names an exact file or directory and contains its completion condition.

---

## Phase 1: Setup and Repository Inventory

**Purpose**: Create the file layout and evidence needed before changing application behavior.

- [ ] T001 Create `docs/baseline/README.md` with sections for support matrix, workspace inventory, test inventory, route inventory, known gaps, artifact measurements, and final verification runs; complete when every section contains an explicit `Pending` placeholder instead of inferred facts
- [ ] T002 [P] Create `docs/baseline/workspace-inventory.md` by listing every workspace from `package.json`, every matching package directory under `apps/` and `packages/`, and every stale root package entry found in `package-lock.json`; complete when `backend` and `web` legacy entries are called out explicitly
- [ ] T003 [P] Create `docs/baseline/test-inventory.md` by enumerating current API `*.spec.ts` files, API scripts under `apps/api/scripts/`, and test commands from all package manifests; complete when missing web/admin tests and missing integration/contract/E2E groups are stated plainly
- [ ] T004 [P] Create `docs/baseline/generated-artifact-inventory.md` listing generated directories and reports currently present or producible (`dist`, `coverage`, Prisma client output, PWA output, OCR benchmark results); complete when each item has a commit/cache policy
- [ ] T005 [P] Create `.editorconfig` with UTF-8, final newline, spaces, two-space indentation for JSON/YAML/JS/TS/Markdown, and four-space indentation only where an existing language convention requires it; complete when no existing source format is contradicted
- [ ] T006 Add `verification-output/`, `apps/api/test-results/`, and generated baseline JSON report paths to `.gitignore`; complete when committed schemas and `docs/baseline/current.md` remain trackable
- [ ] T007 Create `scripts/verification/README.md` documenting script naming, stable step IDs, exit codes, redaction rules, Windows authority, and the rule that scripts must resolve paths from repository root; complete when it links `specs/001-baseline-governance/contracts/verification-interface.md`
- [ ] T008 Create `scripts/verification/lib/paths.mjs` exporting repository-root, workspace, report, coverage, build, and temporary-result paths using `import.meta.url`; complete when paths work regardless of the caller's current directory

**Checkpoint**: Repository inventory and verification script conventions exist without changing
runtime behavior.

---

## Phase 2: Foundational Verification Infrastructure

**Purpose**: Implement shared report, safety, execution, and environment primitives used by every
user story.

**Critical**: Complete this phase before any user-story implementation.

### Contract and Utility Tests

- [ ] T009 [P] Add report contract tests in `scripts/verification/tests/baseline-report.test.mjs` covering a valid passed report, a valid failed report, rejection of unknown fields, rejection of invalid status values, and rejection of missing required arrays; complete when the tests fail because no validator exists
- [ ] T010 [P] Add redaction tests in `scripts/verification/tests/redact.test.mjs` covering passwords, access/refresh tokens, authorization headers, PostgreSQL URLs, Azure keys, email addresses used as credentials, and private image paths; complete when the tests fail because no redactor exists
- [ ] T011 [P] Add environment safety tests in `scripts/verification/tests/environment-safety.test.mjs` covering production `NODE_ENV`, unsafe database names, missing database URL, non-PostgreSQL URLs, and an allowed disposable database name; complete when the tests fail because no guard exists
- [ ] T012 [P] Add step-runner tests in `scripts/verification/tests/run-step.test.mjs` covering pass, non-zero failure, spawn failure, timeout, `not_applicable`, duration recording, and bounded sanitized summaries; complete when the tests fail because no runner exists

### Shared Implementation

- [ ] T013 Implement the JSON Schema validator wrapper in `scripts/verification/lib/validate-report.mjs` using `specs/001-baseline-governance/contracts/baseline-report.schema.json`; complete when T009 passes without weakening the schema
- [ ] T014 Implement secret and personal-data redaction in `scripts/verification/lib/redact.mjs`; complete when T010 passes and redaction never returns the original secret substring
- [ ] T015 Implement the Windows/non-production/database-name guard in `scripts/verification/lib/environment-safety.mjs`; use an explicit disposable database prefix such as `ehsbha_test_`; complete when T011 passes and the guard refuses unsafe destructive operations
- [ ] T016 Implement command execution and result normalization in `scripts/verification/lib/run-step.mjs`; complete when T012 passes and child output is captured without shell-string concatenation
- [ ] T017 Implement report construction and atomic JSON writing in `scripts/verification/lib/report-writer.mjs`; write temporary files then rename within `verification-output/`; complete when an interrupted write cannot leave a valid-looking partial report
- [ ] T018 Add `scripts/verification/tests/report-writer.test.mjs` for unique step IDs, overall status derivation, UTC timestamps, atomic replacement, and schema validation; complete when the test passes against T017
- [ ] T019 Create `scripts/verification/check-prerequisites.mjs` to validate Windows authority, Node major 22, npm availability, lockfile presence, required workspace directories, non-production environment, and safe PostgreSQL URL; complete when each failure prints a stable prerequisite code
- [ ] T020 Add prerequisite tests in `scripts/verification/tests/check-prerequisites.test.mjs` using injected environment/process values instead of changing the real machine; complete when supported Windows passes and Linux returns informational/non-authoritative status
- [ ] T021 Add root `test:verification` and `verify:prerequisites` scripts to `package.json`; complete when `npm run test:verification` runs all `scripts/verification/tests/*.test.mjs` with Node's test runner and `npm run verify:prerequisites` runs T019

### Test Environment Contract

- [ ] T022 Create `apps/api/.env.test.example` with non-production placeholders for PostgreSQL, driver JWT, admin JWT, OCR substitute mode, mail substitute mode, and API port; complete when it contains no usable credential
- [ ] T023 Create `docs/baseline/test-environment.md` documenting how to copy `apps/api/.env.test.example`, required disposable database naming, forbidden production values, test credentials, and cleanup behavior; complete when a contributor can configure the environment without reading source code
- [ ] T024 Add `scripts/verification/tests/env-example.test.mjs` to assert `apps/api/.env.test.example` contains every required key and no committed secret-like value; complete when the test passes and reports the missing key name on failure

**Checkpoint**: Shared verification utilities are tested, safe, and runnable through root scripts.

---

## Phase 3: User Story 1 - Trust a Reproducible Baseline (Priority: P1) MVP

**Goal**: Make one local command prove OCR regressions, clean database setup, service health, tests,
and production builds from a supported Windows environment.

**Independent Test**: From a clean supported Windows checkout and disposable PostgreSQL database,
run `npm ci` followed by `npm run verify`; all blocking steps pass, the E2E step is explicitly
`not_applicable` if absent, and a schema-valid sanitized report is written.

### OCR Semantics and Regression Tests

- [ ] T025 [P] [US1] Create `docs/baseline/ocr-financial-semantics.md` defining canonical gross, received, commission, tips, adjustments, and net meanings for each supported receipt family; cite representative fixture files under `apps/api/test-fixtures/`; complete when every disputed field has one formula and one fixture example
- [ ] T026 [P] [US1] Create `apps/api/test-fixtures/financial-semantics.json` containing only fixture identifiers, expected canonical financial fields, units, and rationale references; complete when no OCR image bytes or personal data are duplicated
- [ ] T027 [US1] Identify the three currently failing OCR suites and add/adjust regression assertions in their existing `apps/api/src/**/*.spec.ts` files to consume `apps/api/test-fixtures/financial-semantics.json`; complete when tests fail for the current incorrect behavior and each assertion names the semantic field
- [ ] T028 [US1] Update only the affected OCR parser/domain files under `apps/api/src/modules/ocr/` so behavior matches `docs/baseline/ocr-financial-semantics.md`; complete when all OCR suites pass without live Azure calls
- [ ] T029 [US1] Run `npm run api:test -- --runInBand` and record the suite/test totals plus any changed fixture cases in `docs/baseline/test-inventory.md`; complete when zero tests fail

### Clean Database and Service Integration Tests

- [ ] T030 [P] [US1] Add database safety integration tests in `apps/api/src/modules/health/health.integration.spec.ts` proving unsafe database names and production mode are rejected before migration cleanup; complete when the test fails before the integration harness exists
- [ ] T031 [P] [US1] Add liveness/readiness integration assertions in `apps/api/src/modules/health/health.integration.spec.ts` for `GET /api/v1/health`, ready database response, and not-ready database response; complete when assertions use the actual global API prefix
- [ ] T032 [US1] Create `apps/api/scripts/test-integration.ts` to load the test environment, call the shared safety guard, generate Prisma client, apply migrations to an empty disposable database, run both seed scripts required by current smoke checks, start the built API on an isolated port, poll health/readiness, and always stop the process; complete when failures exit non-zero and cleanup runs in `finally`
- [ ] T033 [US1] Update `apps/api/package.json` with `test:unit`, `test:integration`, `test:contract`, `test:smoke`, and `test:coverage` scripts mapped to existing Jest/smoke behavior; `test:contract` must report an explicit absent-group result rather than a false test pass
- [ ] T034 [US1] Correct legacy `backend` setup instructions and unsafe assumptions in `apps/api/scripts/smoke.ts`; complete when comments and defaults reference `apps/api`, the test environment, and the disposable seeded database
- [ ] T035 [US1] Execute `npm --workspace @ehsbha/api run test:integration` against a disposable database and document exact prerequisites and observed step IDs in `docs/baseline/test-environment.md`; complete when migration, seed, startup, health, readiness, and shutdown pass

### Root Verification Groups

- [ ] T036 [P] [US1] Create `scripts/verification/not-applicable.mjs` that writes a normalized `not_applicable` step result for an allowed group and reason; complete when unsupported group names exit non-zero
- [ ] T037 [P] [US1] Create `scripts/verification/measure-builds.mjs` to inventory web/admin output files and calculate raw and gzip byte sizes by entry JavaScript, route JavaScript, CSS, asset, and PWA categories; complete when output matches the measurement contract
- [ ] T038 [P] [US1] Add `scripts/verification/tests/measure-builds.test.mjs` using a temporary fake build tree; complete when category classification and byte counts are deterministic
- [ ] T039 [US1] Create `scripts/verification/verify.mjs` with ordered stable steps: prerequisites, Prisma generation, lint, typecheck, unit, integration, contract, smoke, E2E, API build, web build, admin build, route audit, measurement, and report validation; complete when a failed blocking step sets `overallStatus=failed` and exits non-zero after writing the report
- [ ] T040 [US1] Add root scripts `lint`, `test`, `test:integration`, `test:contract`, `test:smoke`, `test:coverage`, `test:e2e`, `verify:measure`, and `verify` to `package.json`; use workspace commands where present and `scripts/verification/not-applicable.mjs` only for explicitly absent allowed groups
- [ ] T041 [US1] Add `scripts/verification/tests/verify.test.mjs` with injected fake commands proving step order, fail propagation, report creation on failure, E2E `not_applicable`, and no execution of destructive integration steps after prerequisite failure; complete when all orchestration tests pass
- [ ] T042 [US1] Add `verification-output/sample-report.json` generation to `npm run verify` but keep the directory ignored; complete when the generated report validates against `specs/001-baseline-governance/contracts/baseline-report.schema.json`
- [ ] T043 [US1] Run `npm run test:verification`, `npm run api:test -- --runInBand`, `npm run test:integration`, and `npm run build`; fix only Phase 0 blocking defects in the files named by failures and record deferred findings in `docs/baseline/known-gaps.md`

**Checkpoint**: User Story 1 is independently complete when the local Windows baseline command is
safe, deterministic, and green.

---

## Phase 4: User Story 2 - Understand the Repository as It Exists (Priority: P1)

**Goal**: Make repository documentation and supported-environment guidance match executable truth.

**Independent Test**: A contributor unfamiliar with the changes can locate API/web/admin, identify
supported prerequisites, and start `npm run verify` within 15 minutes using repository documents
only; no primary document contains legacy `backend/` or root `web/` instructions.

### Documentation Truth Tests

- [ ] T044 [P] [US2] Add `scripts/verification/tests/documentation-truth.test.mjs` scanning `README.md`, `ARCHITECTURE.md`, `ADMIN_ARCHITECTURE.md`, and `ADMIN_SEPARATION_VERIFICATION.md` for legacy `backend/` and root `web/` paths, unresolved pre-implementation gates, and unsupported absolute claims; complete when the test fails against current stale content
- [ ] T045 [P] [US2] Create `docs/baseline/support-matrix.md` specifying Node 22 LTS, lockfile-compatible npm, the verified PostgreSQL version, supported Windows versions, tested browser versions, and `Linux: deferred`; complete when every row has an evidence command or source
- [ ] T046 [P] [US2] Add `scripts/verification/tests/support-matrix.test.mjs` asserting required support-matrix rows and Windows authority; complete when missing versions or a claim of Linux parity fails

### Primary Documentation Updates

- [ ] T047 [US2] Rewrite setup, benchmark, project-layout, and verification paths in `README.md` from legacy `backend/` and root `web/` locations to `apps/api`, `apps/web`, and `apps/admin`; replace unverified numeric claims with evidence links or qualified baseline status
- [ ] T048 [US2] Update `ARCHITECTURE.md` to describe the current React PWA, separate admin application, npm workspaces, Prisma location, independent build outputs, and Phase 0 verification entry point; remove obsolete mobile/pre-monorepo assumptions
- [ ] T049 [US2] Update `ADMIN_ARCHITECTURE.md` so every major capability is labeled `Implemented`, `Partial`, or `Planned` based on current source evidence; remove language that presents future work as existing behavior
- [ ] T050 [US2] Replace stale pre-implementation questions and go/no-go statements in `ADMIN_SEPARATION_VERIFICATION.md` with current verifiable separation evidence and links to known gaps; preserve useful security warnings as current findings
- [ ] T051 [US2] Update `docs/baseline/README.md` with links to the support matrix, test environment, OCR semantics, known gaps, route audits, artifact measurements, and current baseline summary
- [ ] T052 [US2] Run `node --test scripts/verification/tests/documentation-truth.test.mjs scripts/verification/tests/support-matrix.test.mjs`; complete when both tests pass and no exclusion pattern hides a primary document
- [ ] T053 [US2] Perform the 15-minute newcomer walkthrough from `README.md` and `specs/001-baseline-governance/quickstart.md`, then record participant/role, elapsed minutes, blockers, and result in `docs/baseline/newcomer-walkthrough.md`

**Checkpoint**: User Story 2 is independently complete when documentation alone can orient a new
contributor and start the baseline.

---

## Phase 5: User Story 3 - Review Application Coverage and Known Gaps (Priority: P2)

**Goal**: Produce reproducible route, page, backing-service, permission, translation, empty-state,
service-worker, and artifact evidence for the driver and admin applications.

**Independent Test**: Run the route audit command after production builds; every registered route
and current admin page appears exactly once, active failures are blocking, and scaffold/obsolete
surfaces include owner and follow-up.

### Route Audit Tests

- [ ] T054 [P] [US3] Add `scripts/verification/tests/route-manifest.test.mjs` with fixture router source covering static routes, nested routes, lazy imports, redirects, protected routes, and duplicate paths; complete when tests fail because no extractor exists
- [ ] T055 [P] [US3] Add `scripts/verification/tests/coverage-record.test.mjs` covering active-pass, active-fail blocking, scaffold-known-gap ownership, obsolete-known-gap ownership, and rejection of unlabeled known gaps; complete when tests fail because no validator exists
- [ ] T056 [P] [US3] Create `docs/baseline/admin-page-service-map.md` with columns page file, route, activity, API client method, endpoint, required permission, data source (`real` or `scaffold`), status, owner, and follow-up; complete initially with one row per file under `apps/admin/src/pages/`
- [ ] T057 [P] [US3] Create `docs/baseline/web-route-audit.md` and `docs/baseline/admin-route-audit.md` tables with route, route source, lazy module, activity, build result, load result, translation status, empty/error state status, and evidence

### Route and Service Audit Implementation

- [ ] T058 [US3] Implement router-source extraction in `scripts/verification/lib/extract-routes.mjs` for `apps/web/src/router.tsx` or the actual router file discovered from `apps/web/src/App.tsx`, plus the actual admin router file discovered from `apps/admin/src/main.tsx`; complete when T054 passes
- [ ] T059 [US3] Implement coverage-record validation in `scripts/verification/lib/validate-coverage-record.mjs`; complete when T055 passes and any failed active route is forced to `blocking=true`
- [ ] T060 [US3] Create `scripts/verification/audit-routes.mjs` to extract web/admin manifests, compare lazy module paths to source files, consume `docs/baseline/admin-page-service-map.md`, and emit coverage records; complete when duplicate/missing routes and missing active backing services exit non-zero
- [ ] T061 [US3] Add `verify:routes` to `package.json` and replace the placeholder route-audit step in `scripts/verification/verify.mjs` with `scripts/verification/audit-routes.mjs`
- [ ] T062 [US3] Inspect `apps/web/src/lib/`, `apps/web/src/providers/`, and Vite environment usage, then record API base URL behavior and production fallback status in `docs/baseline/web-route-audit.md`; fix only invalid or unsafe Phase 0 configuration in the exact source file found
- [ ] T063 [US3] Inspect `apps/web/vite.config.ts`, `apps/web/public/`, and service-worker registration code, then record manifest/icons/offline asset generation and commit policy in `docs/baseline/web-route-audit.md`; remove committed generated outputs only after confirming they regenerate
- [ ] T064 [US3] Inspect every web route's Arabic/English keys and loading/empty/error rendering, then mark each row in `docs/baseline/web-route-audit.md` as pass, blocking fail, or known gap; do not implement broad UX redesign
- [ ] T065 [US3] Inspect every admin page's API calls and populate endpoint/permission/data-source columns in `docs/baseline/admin-page-service-map.md`; mark a missing required endpoint on an active page as blocking
- [ ] T066 [US3] Inspect every admin route for Super Admin access, lazy module resolution, forbidden handling, and scaffold labels, then complete `docs/baseline/admin-route-audit.md`
- [ ] T067 [US3] Fix active route import failures or missing required active-page endpoint wiring only in the affected files under `apps/web/src/`, `apps/admin/src/`, or `apps/api/src/modules/admin/`; record broader missing workflows as known gaps instead of implementing them
- [ ] T068 [US3] Run `npm run web:build`, `npm run admin:build`, and `npm run verify:routes`; complete when all active routes pass and every retained scaffold/obsolete surface has owner and follow-up

### Artifact Baseline

- [ ] T069 [P] [US3] Create `docs/baseline/artifact-measurements.md` with constitution comparison thresholds for initial JS, lazy chunks, and CSS, while stating that Phase 0 records non-blocking budget excess unless functionality fails
- [ ] T070 [US3] Run `npm run verify:measure` after clean web/admin builds and populate `docs/baseline/artifact-measurements.md` from generated measurement records; complete when every entry and route chunk is classified

**Checkpoint**: User Story 3 is independently complete when route/service truth is exhaustive and
active failures cannot be hidden as known gaps.

---

## Phase 6: User Story 4 - Enforce Shared Quality Gates (Priority: P2)

**Goal**: Make Windows CI use the same verification command as local development and preserve
sanitized diagnostics on failure.

**Independent Test**: Trigger one controlled failure per required gate on a test branch; both local
and CI runs fail on the same stable step ID, and CI uploads sanitized diagnostics without caching
generated application outputs.

### CI Contract Tests

- [ ] T071 [P] [US4] Add `scripts/verification/tests/workflow-contract.test.mjs` asserting `.github/workflows/verify.yml` uses a Windows runner, Node 22, `npm ci`, PostgreSQL setup, `npm run verify`, npm download caching only, and failure artifact upload; complete when the test fails before the workflow exists
- [ ] T072 [P] [US4] Create `docs/baseline/controlled-failure-matrix.md` listing each blocking step ID, the reversible test mutation, expected local exit, expected CI result, and expected artifact; complete when every step in `verify.mjs` has a row

### CI Implementation

- [ ] T073 [US4] Create `.github/workflows/verify.yml` using a supported Windows runner, Node 22, a disposable PostgreSQL service or explicitly started Windows PostgreSQL instance, `npm ci`, and `npm run verify`; do not duplicate gate commands in YAML
- [ ] T074 [US4] Configure `.github/workflows/verify.yml` to cache only npm's download cache keyed by `package-lock.json`; explicitly exclude `node_modules`, `dist`, `coverage`, Prisma generated output, PWA output, and `verification-output`
- [ ] T075 [US4] Configure failure-only artifact upload in `.github/workflows/verify.yml` for sanitized baseline JSON, Jest/coverage output, route audit output, and bounded logs; complete when artifact paths match `.gitignore` and no `.env` file is uploaded
- [ ] T076 [US4] Add workflow redaction assertions to `scripts/verification/tests/workflow-contract.test.mjs` so artifact globs cannot include `.env`, OCR source images, or raw database dumps; complete when T071 passes
- [ ] T077 [US4] Run each reversible case from `docs/baseline/controlled-failure-matrix.md` locally, restore the file after each case, and record actual exit code and stable step ID; do not use destructive Git reset commands
- [ ] T078 [US4] Run or dispatch the same controlled cases through `.github/workflows/verify.yml` and record CI run links/results in `docs/baseline/controlled-failure-matrix.md`; complete when local and CI decisions match for every sampled gate
- [ ] T079 [US4] Add `docs/baseline/ci-operations.md` documenting workflow trigger, required CI variables, disposable database behavior, artifact retention, rerun procedure, and how to diagnose each stable step ID

**Checkpoint**: User Story 4 is independently complete when local and CI acceptance logic is one
implementation and failures remain diagnosable.

---

## Phase 7: User Story 5 - Record Irreversible Decisions (Priority: P3)

**Goal**: Establish durable architecture decision records and connect governance to repository
workflows.

**Independent Test**: Create and validate one accepted ADR; another contributor can locate its
context, alternatives, consequences, owner, and date from repository documentation.

### ADR Tests and Templates

- [ ] T080 [P] [US5] Create `docs/adr/template.md` with ID, title, status, date, owner, context, decision, alternatives, consequences, and supersedes fields matching `specs/001-baseline-governance/data-model.md`
- [ ] T081 [P] [US5] Add `scripts/verification/tests/adr-format.test.mjs` validating required headings, `NNNN-kebab-title.md` naming, accepted status values, ISO date, and non-empty owner; complete when the template passes and malformed fixture content fails
- [ ] T082 [US5] Create `docs/adr/README.md` defining when an ADR is mandatory, lifecycle states, numbering, review ownership, superseding rules, and links to the constitution
- [ ] T083 [US5] Create `docs/adr/0001-windows-authoritative-phase-0-verification.md` recording the selected Windows authority, Linux deferral, alternatives, consequences, owner, and date
- [ ] T084 [US5] Add `verify:adr` to `package.json` and add a blocking ADR-format step to `scripts/verification/verify.mjs`; complete when malformed ADRs fail with a stable step ID
- [ ] T085 [US5] Add ADR and governance references to `README.md`, `ARCHITECTURE.md`, and `docs/baseline/README.md`; complete when a contributor can reach the ADR index from each entry point

**Checkpoint**: User Story 5 is independently complete when qualifying decisions have a tested,
discoverable record format.

---

## Phase 8: Repository Cleanup and Final Baseline Publication

**Purpose**: Remove proven stale metadata, complete security checks, and publish the authoritative
Phase 0 result.

- [ ] T086 Add `scripts/verification/tests/lockfile-workspaces.test.mjs` asserting `package-lock.json` contains only current root/app/package workspaces and no extraneous root `backend` or `web` package entries; complete when the test fails against stale metadata before regeneration
- [ ] T087 Regenerate `package-lock.json` with the supported npm release from current `package.json` workspaces instead of hand-editing JSON; complete when T086 passes and `npm ci` succeeds without changing the lockfile
- [ ] T088 Review dependencies, modules, and script paths identified as unused in `docs/baseline/workspace-inventory.md`; remove an item only when source search, startup, tests, generation, and operational scripts show no reference, and record each removal or retention rationale in that file
- [ ] T089 Add `scripts/verification/tests/sensitive-artifacts.test.mjs` scanning tracked configuration, fixtures, reports, and workflow artifact globs for production secrets, tokens, private image paths, connection strings, and personal data; use allowlisted fake examples only
- [ ] T090 Add `verify:security` to `package.json` and a blocking security-artifact step to `scripts/verification/verify.mjs`; complete when T089 passes and an injected fake production secret is rejected in a controlled test
- [ ] T091 Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run test:contract`, `npm run test:smoke`, `npm run test:coverage`, `npm run test:e2e`, `npm run build`, `npm run verify:routes`, `npm run verify:measure`, `npm run verify:adr`, and `npm run verify:security`; fix only failures inside Phase 0 scope
- [ ] T092 Run `npm run verify` three consecutive times from clean disposable databases on the supported Windows environment and record revision, environment, duration, step statuses, and report paths in `docs/baseline/verification-runs.md`
- [ ] T093 Create `docs/baseline/current.md` summarizing the approved revision, support matrix, overall result, test/build totals, route/service coverage totals, artifact measurements, known limitations, and links to machine-readable evidence
- [ ] T094 Update `docs/baseline/known-gaps.md` so every unresolved item has severity, affected surface, evidence, owner, target phase, and follow-up reference; ensure active route or required-service failures are not listed as acceptable gaps
- [ ] T095 Validate `specs/001-baseline-governance/quickstart.md` from a clean checkout and update only command/path discrepancies in that file; complete when every documented expected outcome is observed
- [ ] T096 Run `git diff --check` and review `git status --short`; remove accidental generated outputs from the change set without reverting user-authored files, and confirm all intended Phase 0 source/docs files remain

**Final Checkpoint**: Phase 0 is complete only when all tasks above are checked, three clean
Windows verification runs pass, and `docs/baseline/current.md` contains no unsupported claim.

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1** has no dependencies.
- **Phase 2** depends on Phase 1 and blocks all user stories.
- **Phase 3 / US1** depends on Phase 2. It is the MVP and provides the root verification command.
- **Phase 4 / US2** depends on Phase 2; T052-T053 should run after US1 exposes the final commands.
- **Phase 5 / US3** depends on Phase 2; T061 and final audit execution depend on US1's verifier.
- **Phase 6 / US4** depends on US1 and should consume completed US2/US3 evidence paths.
- **Phase 7 / US5** depends on Phase 2; T084 integration depends on US1's verifier.
- **Phase 8** depends on all selected user stories.

### User Story Dependencies

```text
Setup -> Foundation -> US1 (MVP)
                    -> US2 documentation truth
                    -> US3 route/service truth

US1 + US2 + US3 -> US4 CI parity
US1 + US5       -> final verification gates
US1..US5        -> final baseline publication
```

- **US1**: No story dependency after Foundation.
- **US2**: Can draft documentation after Foundation; final walkthrough uses US1 commands.
- **US3**: Can build inventories after Foundation; verifier integration uses US1.
- **US4**: Requires US1 and consumes evidence produced by US2/US3.
- **US5**: Can create ADR files after Foundation; verifier integration uses US1.

### Within-Story Ordering

- Write the named failing test first.
- Implement the smallest behavior that passes that test.
- Run the narrow test command.
- Integrate into `scripts/verification/verify.mjs` only after narrow behavior passes.
- Update evidence documents from generated results, not estimates.
- Do not mark a task complete if its completion condition was not executed.

---

## Parallel Opportunities

### Setup

After T001, tasks T002-T005 can run in parallel because they write different inventory/config
files. T006-T008 should be completed before verification implementation begins.

### Foundation

T009-T012 can run in parallel. T013-T016 then implement separate utilities in parallel. T022-T024
can run beside report utility work.

### User Story 1

- T025 and T026 can run in parallel.
- T030 and T031 can be written in parallel before T032.
- T036-T038 can run in parallel.
- T039-T041 are sequential because they modify/test the same orchestrator behavior.

### User Story 2

T044-T046 can run in parallel. T047-T050 can run in parallel because each modifies a different
primary document. T051-T053 follow those updates.

### User Story 3

T054-T057 can run in parallel. T058 and T059 can run in parallel. T062-T066 may be split by web and
admin surfaces after the manifest generator exists.

### User Story 4

T071 and T072 can run in parallel. Workflow implementation tasks T073-T076 are sequential because
they share `.github/workflows/verify.yml` and its contract test.

### User Story 5

T080 and T081 can run in parallel. T082 and T083 can then run in parallel. T084-T085 follow.

---

## Parallel Execution Examples

### Example: Foundation Utilities

```text
Worker A: T009 then T013 in scripts/verification/tests/baseline-report.test.mjs and scripts/verification/lib/validate-report.mjs
Worker B: T010 then T014 in scripts/verification/tests/redact.test.mjs and scripts/verification/lib/redact.mjs
Worker C: T011 then T015 in scripts/verification/tests/environment-safety.test.mjs and scripts/verification/lib/environment-safety.mjs
Worker D: T012 then T016 in scripts/verification/tests/run-step.test.mjs and scripts/verification/lib/run-step.mjs
```

### Example: Documentation Truth

```text
Worker A: T047 in README.md
Worker B: T048 in ARCHITECTURE.md
Worker C: T049 in ADMIN_ARCHITECTURE.md
Worker D: T050 in ADMIN_SEPARATION_VERIFICATION.md
```

### Example: Route Audits

```text
Worker A: T062-T064 for apps/web and docs/baseline/web-route-audit.md
Worker B: T065-T066 for apps/admin and docs/baseline/admin-page-service-map.md
Integrator: T067-T068 after both evidence sets are complete
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1.
2. Complete Phase 2.
3. Complete Phase 3 / User Story 1.
4. Stop and run the US1 independent test from a clean Windows checkout.
5. Do not begin CI or broad documentation cleanup until the local verifier is trustworthy.

### Incremental Delivery

1. **MVP**: Safe local baseline and green OCR/database/build checks.
2. **Repository truth**: Correct documentation and support matrix.
3. **Surface truth**: Complete route/service inventories and artifact measurements.
4. **Enforcement**: Windows CI parity and controlled-failure proof.
5. **Governance**: ADR process and first accepted decision.
6. **Release gate**: Cleanup, security scan, three clean runs, final baseline.

### Lower-Capability Model Rules

- Read the task's named source files before editing.
- Modify only files named by the current task unless a failing narrow test identifies a direct
  dependency; document that dependency in the task notes before editing it.
- Never guess route paths, endpoint paths, environment keys, or OCR semantics; derive them from
  source or the Phase 0 evidence documents.
- Never hand-edit `package-lock.json`; regenerate it with npm.
- Never use a production database or credentials.
- Never mark `not_applicable` for unit, integration, migration, build, route audit, ADR, or
  security gates.
- Preserve user changes and unrelated dirty-worktree files.
- Run the narrow completion command after every task and keep the task unchecked if it fails.
- At each checkpoint, run `git diff --check` before continuing.

---

## Task Count Summary

| Phase | Tasks |
|---|---:|
| Setup | 8 |
| Foundation | 16 |
| US1 | 19 |
| US2 | 10 |
| US3 | 17 |
| US4 | 9 |
| US5 | 6 |
| Final | 11 |
| **Total** | **96** |

