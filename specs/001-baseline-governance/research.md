# Research: Baseline, Governance, and Repository Truth

## Decision 1: Authoritative Verification Platform

**Decision**: Phase 0 verification is authoritative on supported 64-bit Windows environments.
Linux runs may provide information but do not establish Phase 0 acceptance.

**Rationale**: This follows the explicit clarification and the current development environment.
It prevents unverified cross-platform claims while keeping future Linux compatibility possible.

**Alternatives considered**:
- Windows and Linux parity in Phase 0: rejected because it expands the agreed scope.
- Linux-only authority: rejected because it conflicts with the selected baseline.

## Decision 2: Runtime and Package Installation

**Decision**: Use Node.js 22 LTS, npm workspaces, `npm ci`, and the committed lockfile as the
dependency baseline.

**Rationale**: Workspace manifests use TypeScript 5.7 and Node 22 type definitions, while current
build dependencies support Node 22. `npm ci` detects manifest/lockfile drift and creates a
reproducible installation.

**Alternatives considered**:
- Support multiple Node majors immediately: rejected because it multiplies verification matrices.
- Replace npm: rejected because no Phase 0 requirement justifies package-manager migration.

## Decision 3: Verification Command Shape

**Decision**: Provide one root `npm run verify` command that invokes named blocking groups and
produces a consolidated machine-readable baseline report.

**Rationale**: Local and CI acceptance must be identical and diagnosable. Named groups preserve
independent execution while one orchestrator provides the completion signal.

**Alternatives considered**:
- CI-only orchestration: rejected because local reproduction would diverge.
- One opaque script: rejected because failures would be harder to isolate.

## Decision 4: Test Group Minimums

**Decision**: Integration coverage for clean database initialization, API startup, liveness, and
readiness is mandatory. The Phase 0 E2E command may return `not_applicable` with an explicit reason.

**Rationale**: This satisfies the clarified baseline without inventing later browser journeys.
Missing groups are visible and cannot inflate coverage claims.

**Alternatives considered**:
- Require browser E2E now: rejected as later-phase scope.
- Allow empty integration groups: rejected because database/startup behavior is a Phase 0 exit
  criterion.

## Decision 5: Database Isolation

**Decision**: Run migration/seed/startup checks against a dedicated disposable PostgreSQL database
guarded by an explicit test environment and database-name allowlist.

**Rationale**: Prisma migration behavior depends on PostgreSQL semantics. An isolated database
provides representative evidence and prevents accidental destructive use of development or
production data.

**Alternatives considered**:
- Mock persistence: rejected because it cannot verify migrations or readiness.
- Reuse a developer database: rejected because state makes results non-deterministic.

## Decision 6: OCR Financial Semantics

**Decision**: Documented product rules and representative OCR source fixtures determine the
canonical meaning of gross, received, commission, tips, adjustments, and net values. Code and tests
must both conform.

**Rationale**: Neither failing tests nor current parser behavior is inherently authoritative.
Fixture-backed product rules provide reviewable evidence.

**Alternatives considered**:
- Preserve current parser behavior: rejected because it may encode the regression.
- Preserve existing assertions: rejected because tests may describe obsolete semantics.

## Decision 7: Route Audit Strategy

**Decision**: Derive route manifests from router sources, prove lazy imports through production
builds, and add deterministic route/service coverage evidence. Use browser preview smoke only when
static/build evidence cannot prove an active route loads.

**Rationale**: This keeps Phase 0 focused while still making active failures blocking. It avoids
pretending that a full browser E2E suite exists.

**Alternatives considered**:
- Manual-only review: rejected because it is not repeatable.
- Full E2E framework rollout: rejected as broader than the selected phase.

## Decision 8: Baseline Evidence Format

**Decision**: Store a versioned JSON baseline report for automation and a concise Markdown summary
for contributors. Generate reports during verification; commit only the approved current baseline
summary and schemas, not transient logs or build outputs.

**Rationale**: Structured results support CI and comparison, while Markdown supports review.
Transient outputs can contain noise or sensitive information.

**Alternatives considered**:
- Markdown only: rejected because automated validation and comparison are fragile.
- Commit all reports: rejected because generated noise would become repository truth.

## Decision 9: CI Caching and Failure Artifacts

**Decision**: Cache npm download data only. Upload sanitized test, coverage, and verification
reports on failure.

**Rationale**: Dependency downloads are safe to reuse, while generated clients and application
outputs must be recreated to prove the build.

**Alternatives considered**:
- Cache build outputs: rejected because stale outputs can mask failures.
- Retain no artifacts: rejected because it weakens diagnosis.

## Decision 10: Lockfile Legacy Entries

**Decision**: Regenerate the lockfile from the current `apps/*` and `packages/*` workspace truth and
verify that legacy root `backend` and `web` package entries disappear without dependency loss.

**Rationale**: The current lockfile includes extraneous legacy workspace records, which conflicts
with repository truth and can confuse audits.

**Alternatives considered**:
- Hand-edit lockfile JSON: rejected because package-manager metadata should be generated.
- Leave entries indefinitely: rejected because Phase 0 explicitly removes stale paths after proof.

