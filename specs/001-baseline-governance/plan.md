# Implementation Plan: Baseline, Governance, and Repository Truth

**Branch**: `001-baseline-governance` | **Date**: 2026-06-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-baseline-governance/spec.md`

## Summary

Establish a Windows-authoritative, reproducible repository baseline before feature expansion.
The implementation will stabilize OCR regressions from documented product semantics and fixture
evidence, add one root verification command, introduce deterministic test and clean-database
checks, audit all web/admin routes and backing services, correct repository documentation, record
support and architecture decisions, and run the same blocking gates in CI. Phase 0 changes
verification and governance surfaces only; it does not redesign product domains or implement later
platform phases.

## Technical Context

**Language/Version**: TypeScript 5.7 on Node.js 22 LTS

**Primary Dependencies**: npm workspaces and lockfile v3; NestJS 11; Prisma 6; React 19; Vite 6;
Jest 29; Zod 3; existing PowerShell-compatible repository scripts

**Storage**: PostgreSQL through Prisma for clean migration, seed, startup, health, and readiness
integration checks; JSON and Markdown files for baseline evidence and governance records

**Testing**: Jest unit/regression tests; new database/startup integration checks; existing API
smoke script; build and route audits for web/admin; coverage reports; no mandatory Phase 0 browser
E2E suite

**Target Platform**: Supported 64-bit Windows development and CI environment. Linux results are
informational and compatibility is deferred.

**Project Type**: npm monorepo with one API service and two independently built browser
applications

**Performance Goals**: Record compressed application/route artifact sizes and verification
duration; do not introduce optimization work unless a route or build cannot function. Preserve
the constitution budgets as comparison thresholds.

**Constraints**: One `npm run verify` entry point; locked dependency installation; no live
production services or secrets; clean disposable test database; deterministic outcomes; active
route/service failures block completion; generated outputs are not cached or committed as source

**Scale/Scope**: Three applications, four shared-package directories, all registered web/admin
routes, all existing API tests including the 10 known OCR assertion failures across three suites,
four primary architecture documents, and one CI verification workflow

## Constitution Check

*GATE: Passed before research and passed again after design.*

| Gate | Status | Evidence |
|---|---|---|
| Feature-first boundary and dependency direction | PASS | Work is isolated to repository verification, documentation, test configuration, and evidence artifacts; application boundaries remain unchanged. |
| Framework-independent domain behavior | PASS | Only OCR financial semantics may change, and the canonical rule is documented independently of parser/test implementation. |
| Shared contracts and compatibility | PASS | No public API contract redesign is planned. Verification output contracts are internal repository interfaces documented under `contracts/`. |
| Strict TypeScript and import/cycle enforcement | PASS | Existing strict typechecks remain blocking; Phase 0 adds lint/verification orchestration without weakening compiler settings. |
| Security and privacy | PASS | Test configuration is non-production, realms remain separate, artifacts are redacted, and secret detection is a blocking gate where configured. |
| Test layers | PASS | Unit/regression, required integration, smoke, coverage, clean migration/seed, builds, and route audits are planned. Browser E2E absence is reported explicitly. |
| Performance and scale | PASS | Baseline artifact sizes and verification duration are measured; optimization is deferred unless functionality is blocked. |
| Operations and recovery | PASS | CI failure artifacts, deterministic setup, liveness/readiness, migration validation, failure diagnosis, and rollback-neutral additive changes are included. |
| Accessibility, localization, offline, failure states | PASS | Existing route audit records missing translations, empty/error states, RTL/LTR, and service-worker issues without expanding into Phase 8 remediation. |

## Project Structure

### Documentation (this feature)

```text
specs/001-baseline-governance/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- baseline-report.schema.json
|   `-- verification-interface.md
|-- checklists/
|   `-- requirements.md
`-- tasks.md                 # Created by /speckit-tasks
```

### Source Code (repository root)

```text
/
|-- package.json             # Root quality/test/build/verify orchestration
|-- package-lock.json        # Locked dependency truth; remove stale workspace entries
|-- .editorconfig            # Shared editor settings
|-- .github/workflows/       # Windows-authoritative verification workflow
|-- docs/
|   |-- adr/                 # Architecture decision records and template
|   `-- baseline/            # Current baseline and route/service audit evidence
|-- README.md
|-- ARCHITECTURE.md
|-- ADMIN_ARCHITECTURE.md
|-- ADMIN_SEPARATION_VERIFICATION.md
|-- apps/api/
|   |-- package.json
|   |-- prisma/
|   |-- scripts/
|   |-- src/
|   `-- test-fixtures/
|-- apps/web/
|   |-- package.json
|   |-- src/
|   `-- vite.config.*
|-- apps/admin/
|   |-- package.json
|   |-- src/
|   `-- vite.config.*
`-- packages/
    |-- api-contracts/
    |-- shared-types/
    |-- eslint-config/
    `-- ui-tokens/
```

**Structure Decision**: Use repository-level scripts and evidence directories because Phase 0 is
cross-cutting governance work, not a new product feature module. Existing application code is
touched only where a failing regression, route, configuration, or stale script must be corrected.
No new shared product package is introduced.

## Implementation Design

### 1. Establish Repository Truth

- Inventory actual workspaces, package manifests, lockfile entries, routes, API endpoints, tests,
  migrations, generated outputs, and operational scripts.
- Treat source and executable manifests as authoritative over narrative documentation.
- Remove stale `backend` and `web` lockfile workspace records through a clean lockfile refresh,
  after confirming current workspaces install correctly.
- Publish a support matrix for Node 22 LTS, the lockfile-compatible npm release, PostgreSQL,
  supported browsers, and supported Windows versions.

### 2. Stabilize OCR Semantics

- Build a decision table for gross, received, commission, tips, adjustments, and net values by
  supported receipt type.
- Use documented product rules and representative golden fixtures as the authority.
- Update parser behavior and regression assertions together where they disagree with the decision
  table.
- Keep Azure network calls outside deterministic regression tests; tests consume fixture text or
  provider substitutes.

### 3. Verification Orchestration

- Add root commands for `lint`, `test`, `test:integration`, `test:contract`, `test:smoke`,
  `test:coverage`, `test:e2e`, `build`, and `verify`.
- `verify` executes prerequisite validation, generation, lint, typecheck, unit/regression tests,
  required integration tests, clean migration/seed, smoke checks, production builds, route audits,
  artifact measurement, and evidence aggregation.
- A missing Phase 0 E2E suite is reported as `not_applicable`, not as a silent pass.
- Every blocking step propagates a non-zero exit code and writes a bounded diagnostic result.

### 4. Deterministic Database and Service Integration

- Use a dedicated disposable PostgreSQL database with non-production credentials.
- Validate generation, migration from empty state, seed idempotence expectations, API startup,
  liveness, and readiness.
- Ensure test cleanup cannot target a non-test database through explicit database-name and
  environment guards.
- Capture migration and startup failures in the baseline report without secrets or raw connection
  strings.

### 5. Web and Admin Audits

- Derive route inventories from each router source.
- Verify production builds resolve every lazy import.
- Exercise each active route using the lightest deterministic method available in Phase 0:
  static route manifest checks plus preview/browser smoke only where required to prove loading.
- Map current admin pages to backing API endpoints and permission expectations.
- Block completion for active route load failures or missing required backing services.
- Retain clearly labeled obsolete or scaffold-only surfaces as known gaps.
- Record API base URL behavior, service-worker/generated asset status, translations, empty/error
  states, console/request failures, and artifact sizes.

### 6. Documentation and Governance

- Correct the four primary documents against current repository evidence.
- Remove unqualified claims that cannot be reproduced.
- Add `docs/adr/README.md`, an ADR template, and an initial ADR for Windows-authoritative Phase 0
  verification.
- Keep the constitution binding; documentation links to it rather than duplicating all rules.

### 7. CI

- Run on a supported Windows runner using `npm ci`.
- Execute the root verification command so local and CI acceptance logic remain identical.
- Cache the npm download cache only; do not cache `dist`, generated clients, coverage, or PWA
  outputs.
- Upload sanitized verification, test, and coverage artifacts when a required gate fails.

## Delivery Sequence

1. Inventory and support matrix.
2. OCR semantic decision table and regression fixes.
3. Deterministic test environment and required integration checks.
4. Root script taxonomy and `verify`.
5. Web/admin route, endpoint, permission, translation, and asset audits.
6. Documentation, ADR, formatting, and stale lockfile/script cleanup.
7. Windows CI using the same verification entry point.
8. Three clean verification trials and final baseline publication.

## Post-Design Constitution Check

All gates remain PASS. The design introduces no new application dependency, no public contract
change, no cross-realm authentication change, and no unsupported framework abstraction. The
Windows-only verification authority is an explicit product clarification, documented limitation,
and ADR rather than an implicit portability claim.

## Complexity Tracking

No constitution violations require justification.

