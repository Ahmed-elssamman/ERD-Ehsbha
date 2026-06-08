# Quickstart: Validate Phase 0

This guide describes the expected validation flow after Phase 0 implementation.

## Prerequisites

- Supported 64-bit Windows environment
- Node.js 22 LTS and a compatible npm release
- PostgreSQL version listed in the repository support matrix
- A disposable database whose name matches the documented test-database safety rule
- Non-production environment values only

Linux results are informational and do not establish Phase 0 acceptance.

## 1. Install the Locked Workspace

```powershell
npm ci
```

Expected outcome: installation succeeds without modifying `package-lock.json`, and only current
`apps/*` and `packages/*` workspaces are recognized.

## 2. Configure the Test Environment

Create the documented local test environment from its checked-in example and set the disposable
PostgreSQL connection. Do not use production or shared development credentials.

Expected outcome: the verification preflight recognizes the environment as non-production and
safe for clean migration.

## 3. Run the Complete Baseline

```powershell
npm run verify
```

Expected outcome:

- Generation, lint, typecheck, unit/regression, required integration, migration/seed, smoke, build,
  route audit, and measurement steps pass.
- The E2E group is either passed or explicitly `not_applicable`.
- A sanitized report conforming to
  [`contracts/baseline-report.schema.json`](./contracts/baseline-report.schema.json) is produced.
- The command exits non-zero if any blocking step fails.

## 4. Validate OCR Semantics

Run the named API regression command documented by the implementation.

Expected outcome: all existing OCR regressions pass, and any changed assertion traces to the
canonical financial semantics decision table and representative fixture evidence.

## 5. Validate Clean Database Behavior

Run the integration group independently:

```powershell
npm run test:integration
```

Expected outcome: a clean disposable database migrates and seeds, the API starts, and liveness and
readiness checks pass. The command refuses to clean an unsafe database.

## 6. Review Route and Service Coverage

Open the generated baseline summary under the documented `docs/baseline/` location.

Expected outcome:

- Every registered web/admin route has a result.
- Every current admin page has a backing-service status and permission expectation.
- Active failures are blocking.
- Obsolete or scaffold-only surfaces are clearly labeled with an owner and follow-up.

## 7. Compare Local and CI

Run the Windows CI workflow for the same revision.

Expected outcome: local and CI runs use `npm run verify`, expose the same stable step IDs, and
produce the same pass/fail decision. Failure artifacts contain useful diagnostics but no secrets
or personal data.

## Acceptance

Phase 0 is complete only after three consecutive clean Windows verification trials pass and the
approved baseline summary records the revision, support matrix, known limitations, route/service
coverage, and artifact measurements.

