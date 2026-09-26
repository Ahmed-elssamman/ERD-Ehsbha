# Feature Specification: Baseline, Governance, and Repository Truth

**Feature Branch**: `001-baseline-governance`

**Created**: 2026-06-07

**Status**: Draft

**Input**: User description: "Read plan.md and create a specification for Phase 0 - Baseline, Governance, and Repository Truth only."

## Clarifications

### Session 2026-06-07

- Q: What authority determines the correct OCR trip financial semantics when parser behavior and
  existing test expectations disagree? → A: Documented product rules and representative OCR source
  evidence are authoritative; parser behavior and tests must both align with that evidence.
- Q: Which named test groups must contain executable tests in Phase 0? → A: Integration coverage
  for database initialization, service startup, health, and readiness is mandatory; the end-to-end
  group may explicitly report that no Phase 0 suite exists.
- Q: Which operating-system environment is authoritative for Phase 0 verification? → A: Windows
  is authoritative; Linux compatibility verification is deferred.
- Q: Which route and page audit findings block Phase 0 completion? → A: Broken loading or missing
  required services for active routes and pages block completion; clearly labeled obsolete or
  scaffold-only surfaces may remain as documented gaps.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trust a Reproducible Baseline (Priority: P1)

As a contributor or reviewer, I need one reliable verification entry point so I can determine
whether the repository is healthy before approving or starting feature work.

**Why this priority**: Later phases cannot be evaluated safely while existing tests, builds,
database setup, and runtime checks produce inconsistent or failing results.

**Independent Test**: Start from a clean supported environment, run the documented verification
entry point, and confirm that every required check runs in a defined order and reports a clear
pass or failure.

**Acceptance Scenarios**:

1. **Given** a clean checkout and supported prerequisites, **When** a contributor follows the
   documented setup and verification process, **Then** all existing tests, production builds,
   database initialization checks, and service health checks complete successfully.
2. **Given** a required check fails, **When** verification completes, **Then** the overall result
   is failed and identifies the failing check without reporting a false success.
3. **Given** the existing OCR regression set, **When** the relevant tests run, **Then** all
   assertions pass and the accepted financial meaning of each disputed value is documented.

---

### User Story 2 - Understand the Repository as It Exists (Priority: P1)

As a new contributor or operator, I need the primary documentation to describe the current
applications, paths, responsibilities, and supported environments so I do not act on obsolete
architecture assumptions.

**Why this priority**: Stale repository guidance creates incorrect setup, deployment, ownership,
and design decisions even when the code itself works.

**Independent Test**: Use only the maintained repository documentation to locate each application,
understand its purpose, identify supported prerequisites, and complete the baseline setup without
encountering obsolete paths or contradictory claims.

**Acceptance Scenarios**:

1. **Given** the current repository structure, **When** a reviewer checks the primary readme and
   architecture documents, **Then** every referenced application path and product surface matches
   the repository.
2. **Given** an administration capability that already exists, **When** its architecture and
   separation documents are reviewed, **Then** they distinguish implemented behavior, incomplete
   behavior, and planned behavior accurately.
3. **Given** a contributor preparing a local environment, **When** they consult the support
   matrix, **Then** they can identify supported runtime, package manager, database, browser, and
   operating-system versions.

---

### User Story 3 - Review Application Coverage and Known Gaps (Priority: P2)

As a product or engineering owner, I need an evidence-based inventory of driver, administration,
and service surfaces so obsolete stubs, broken routes, missing endpoints, and scaffold data are
visible before expansion.

**Why this priority**: A green build alone does not prove that routes load, pages use real
services, translations are complete, or user-facing failure states work.

**Independent Test**: Review the resulting coverage records and sample every registered route and
current administration page to verify that each has an explicit status and evidence.

**Acceptance Scenarios**:

1. **Given** the driver application route inventory, **When** all routes are checked, **Then** each
   route builds, loads through its intended entry point, and has no unrecorded critical console,
   data-loading, translation, or empty-state failure.
2. **Given** the administration route inventory and a fully privileged test account, **When** all
   routes are checked, **Then** each route loads and its backing service status is recorded.
3. **Given** an obsolete stub or scaffold-only page, **When** the inventory is published, **Then**
   it is removed or clearly labeled and cannot be mistaken for complete production behavior.
4. **Given** the current permission model, **When** route coverage is reviewed, **Then** every
   administration route has a recorded permission expectation or a documented reason it is
   unrestricted.

---

### User Story 4 - Enforce Shared Quality Gates (Priority: P2)

As a maintainer, I need local and automated verification to apply the same required gates so work
cannot be accepted when tests, builds, database setup, or repository quality checks fail.

**Why this priority**: Different local and automated standards allow regressions to merge and make
failure reproduction unnecessarily difficult.

**Independent Test**: Introduce one controlled failure for each required gate and confirm that both
local verification and automated verification reject it and retain useful failure evidence.

**Acceptance Scenarios**:

1. **Given** a change submitted for review, **When** automated verification runs, **Then** it uses
   a locked dependency set and performs generation, code-quality, type-safety, test, clean database,
   and production-build checks.
2. **Given** any required gate fails, **When** the automated run finishes, **Then** acceptance is
   blocked and relevant test or coverage evidence is retained for diagnosis.
3. **Given** repeated verification runs from the same revision and supported environment, **When**
   no external dependency has changed, **Then** the pass/fail outcome is consistent.
4. **Given** generated application outputs, **When** dependency caching is used, **Then** those
   outputs are not treated as reusable source-of-truth artifacts.

---

### User Story 5 - Record Irreversible Decisions (Priority: P3)

As an architecture owner, I need a standard decision record location and governance rules so
future contributors can understand why significant repository decisions were made.

**Why this priority**: Phase 0 must establish decision traceability, but decision recording is
valuable after the reproducible baseline and repository truth are in place.

**Independent Test**: Create a sample qualifying decision using the documented process and verify
that its context, alternatives, consequences, owner, and date can be found by another contributor.

**Acceptance Scenarios**:

1. **Given** an irreversible or cross-cutting decision, **When** it is approved, **Then** a decision
   record is stored in the documented location with the required fields.
2. **Given** the repository governance rules, **When** a contributor reviews them, **Then** they
   can identify mandatory architecture, security, testing, and quality gates.

### Edge Cases

- A check passes locally but fails in the automated environment because prerequisites or
  environment values differ.
- A test failure exposes a disagreement between an existing assertion and intended product
  semantics rather than a simple code defect.
- A registered route builds but fails only when its lazy-loaded module or backing request is used.
- A page points to a missing service, a renamed service, or scaffold data that resembles real data.
- A documentation statement is technically true for a legacy layout but false for the current
  repository.
- A generated asset or report is present in version control and could be mistaken for maintained
  source.
- A dependency or module appears unused but is loaded indirectly or required by an operational
  script.
- A clean database can migrate but cannot seed, start, or report ready status.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST provide one documented verification entry point that runs every
  required Phase 0 quality gate and returns a failed result when any required gate fails.
- **FR-002**: Verification MUST cover code quality, type safety, existing automated tests,
  applicable integration checks, clean database initialization and seed, production builds for
  all three applications, and service health and readiness.
- **FR-003**: The existing OCR regression set MUST pass. When parser behavior and test expectations
  disagree, documented product rules and representative OCR source evidence MUST determine the
  canonical trip financial meanings, and both parser behavior and tests MUST be updated to align
  with that evidence.
- **FR-004**: Test execution MUST be organized into clearly named unit, integration, contract,
  smoke, coverage, and end-to-end groups. Phase 0 MUST include executable integration coverage for
  database initialization, service startup, health, and readiness. The end-to-end group MAY report
  that no Phase 0 suite exists; every other absent group MUST also be reported honestly rather than
  presented as passing coverage.
- **FR-005**: The test environment MUST define deterministic, non-production configuration and
  MUST NOT depend on live production services or secrets.
- **FR-006**: The database baseline MUST demonstrate generation, clean migration, seed, service
  start, liveness, and readiness from a clean supported environment.
- **FR-007**: The driver application audit MUST account for every registered route and record
  build/load status, configuration validity, critical console or request failures, missing
  translations, broken empty states, service-worker status, generated asset status, and baseline
  bundle measurements.
- **FR-008**: The administration application audit MUST account for every registered route and
  record privileged-user load status, backing service availability, obsolete stubs, scaffold-only
  data, and expected permission coverage.
- **FR-008A**: An active driver or administration route that fails to load, or an active page whose
  required backing service is missing, MUST block Phase 0 completion. Obsolete or scaffold-only
  surfaces MAY remain only when they are clearly labeled and recorded as known gaps.
- **FR-009**: Primary repository documentation MUST match the current application layout and
  distinguish current, incomplete, and planned behavior.
- **FR-010**: The repository MUST document supported versions for the runtime, package manager,
  database, browsers, and Windows versions used for development and verification. Linux
  compatibility MUST be identified as deferred rather than represented as verified.
- **FR-011**: The repository MUST provide a standard location and minimum content requirements for
  architecture decision records covering irreversible or cross-cutting decisions.
- **FR-012**: Repository governance MUST state binding architecture, security, testing, quality,
  and completion gates for subsequent work.
- **FR-013**: Automated verification MUST install from the locked dependency set and run the same
  required acceptance gates as the documented local verification entry point.
- **FR-014**: Automated verification MUST retain relevant test and coverage reports when a run
  fails.
- **FR-015**: Dependency caching MAY reduce repeated setup time but MUST NOT cache generated
  application outputs as authoritative inputs.
- **FR-016**: Dead modules, unused dependencies, and stale script paths MUST be removed only after
  evidence shows they are not referenced by application startup, tests, generation, deployment,
  or operational workflows.
- **FR-017**: Phase 0 MUST publish a baseline record that identifies the revision, supported
  environment, verification result, known limitations, route/API coverage findings, and measured
  application artifact sizes.
- **FR-018**: Phase 0 MUST NOT add new product capabilities, redesign domain contracts, replace
  authentication mechanisms, complete later administration workflows, or implement offline,
  observability, billing, or production-release features except where required to restore the
  existing baseline.

### Security and Privacy Requirements *(mandatory)*

- **SR-001**: Verification configuration, reports, logs, fixtures, and retained artifacts MUST NOT
  expose production secrets, credentials, tokens, private images, or personal data.
- **SR-002**: Driver and administration security realms MUST remain separate during baseline
  verification, including test credentials and environment configuration.
- **SR-003**: Baseline audits MUST record existing high-risk security gaps without expanding Phase
  0 into their later remediation phases, unless a gap prevents safe verification or exposes a
  secret.
- **SR-004**: Automated verification MUST reject committed secrets and unapproved sensitive
  generated artifacts when existing repository controls support those checks.

### Non-Functional Requirements *(mandatory)*

- **NFR-001**: A complete local verification run MUST be repeatable from a clean supported
  environment with no undocumented manual correction between required checks.
- **NFR-002**: Two consecutive verification runs for the same revision and environment MUST
  produce the same pass/fail outcome; any approved external-service exception MUST be documented.
- **NFR-003**: Every route and service coverage record MUST be traceable to a reproducible check,
  observation, or named reviewer action.
- **NFR-004**: Baseline application artifact and route-chunk measurements MUST be recorded without
  imposing optimization work that belongs to a later performance phase.
- **NFR-005**: Documentation MUST be understandable by a new contributor and enable repository
  orientation and baseline verification without relying on undocumented tribal knowledge.
- **NFR-006**: Required verification failures MUST be diagnosable from the retained output without
  rerunning the entire pipeline solely to discover which gate failed.
- **NFR-007**: Phase 0 changes MUST preserve compatibility with the current driver, administration,
  and service deployment boundaries.
- **NFR-008**: The authoritative Phase 0 verification result MUST be produced on a supported
  Windows environment; results from other operating systems are informational until compatibility
  verification is completed in a later phase.

### Key Entities

- **Verification Baseline**: A dated record tying a repository revision and supported environment
  to required gate results, known limitations, and measured artifact sizes.
- **Coverage Record**: Evidence for a route, page, permission expectation, or backing service,
  including status, finding type, and follow-up ownership.
- **Support Matrix**: The approved runtime, package manager, database, browser, and operating-system
  versions for setup and verification.
- **Architecture Decision Record**: A durable record of a significant decision, including context,
  alternatives, consequences, owner, and date.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing automated tests pass in one complete verification run on a clean
  supported environment, measured by the consolidated verification report.
- **SC-002**: 100% of production builds for the driver, administration, and service applications
  pass from the locked dependency set, measured by local and automated verification.
- **SC-003**: A clean database setup completes migration and seed and reaches healthy and ready
  states in 100% of three consecutive clean-environment trials.
- **SC-004**: 100% of registered driver and administration routes have a recorded load result, and
  100% of current administration pages have a recorded backing-service status. All active routes
  load and all active pages have their required backing services; any remaining obsolete or
  scaffold-only surface is clearly labeled and recorded as a known gap.
- **SC-005**: Zero obsolete repository paths or unqualified pre-implementation claims remain in
  the four primary documents named by Phase 0, measured by documentation review against the
  current repository.
- **SC-006**: A new contributor can locate all three applications, identify supported prerequisites,
  and start the documented verification process within 15 minutes using repository documentation
  alone, measured in a walkthrough by someone not involved in the updates.
- **SC-007**: The documented local verification entry point and automated verification produce the
  same pass/fail decision for the same revision on supported Windows environments in 100% of three
  comparison runs.
- **SC-008**: Controlled failures in each required gate are rejected and identify the responsible
  gate in 100% of sampled checks.
- **SC-009**: Zero production secrets or personal data are found in committed test configuration,
  verification logs, fixtures, or retained reports during the Phase 0 review.

## Assumptions

- Phase 0 stabilizes and documents existing behavior; feature development from Phases 1-10 is out
  of scope.
- The current repository structure and three application boundaries are authoritative.
- Existing tests are preserved unless evidence confirms that an expectation conflicts with agreed
  product semantics.
- External providers are replaced with deterministic substitutes for baseline verification where
  practical.
- Performance work is limited to recording baseline measurements; optimization belongs to later
  phases unless a regression prevents a route or build from functioning.
- Security weaknesses identified by the plan are recorded as known gaps and handled in their
  assigned phases unless they prevent safe Phase 0 operation.
- Linux compatibility verification is deferred; Phase 0 does not claim cross-platform parity.
- Removal of apparently unused code requires evidence because indirect loading and operational
  scripts may not be visible from a simple source reference search.
