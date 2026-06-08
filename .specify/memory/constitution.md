<!--
Sync Impact Report
- Version change: template/unratified -> 1.0.0
- Modified principles:
  - Placeholder Principle 1 -> I. Feature-First Clean Architecture
  - Placeholder Principle 2 -> II. SOLID, Explicit Dependencies, and Simplicity
  - Placeholder Principle 3 -> III. Strict Type Safety and Shared Contracts
  - Placeholder Principle 4 -> IV. Security, Privacy, and Authorization by Design
  - Placeholder Principle 5 -> V. Tested, Observable, and Operable Delivery
- Added sections: architecture, frontend, backend, naming, testing, performance, security,
  Git/PR standards, review checklist, and Definition of Done.
- Removed sections: none; template placeholders were replaced by concrete sections.
- Templates:
  - ✅ .specify/templates/plan-template.md
  - ✅ .specify/templates/spec-template.md
  - ✅ .specify/templates/tasks-template.md
  - ✅ .specify/templates/checklist-template.md (reviewed; no change required)
- Runtime guidance reviewed: plan.md, README.md, ARCHITECTURE.md,
  ADMIN_ARCHITECTURE.md, and ADMIN_SEPARATION_VERIFICATION.md.
- Follow-up TODOs: none.
-->

# Ehsbha Engineering Constitution

## Core Principles

### I. Feature-First Clean Architecture

Every product capability MUST be delivered as an end-to-end feature slice with an explicit
owner and boundary. Business rules MUST remain independent of React, NestJS, Prisma, HTTP,
storage, and third-party providers. Dependencies MUST point inward:

1. Domain rules and value objects depend on no framework.
2. Application use cases coordinate domain behavior through interfaces.
3. Infrastructure implements persistence, messaging, OCR, mail, and provider interfaces.
4. Delivery adapters expose use cases through HTTP, scheduled jobs, or UI.

`apps/api` MUST organize new work under domain modules. `apps/web` and `apps/admin` MUST
move toward feature folders containing their components, hooks, queries, schemas, and tests.
Global `components`, `lib`, and `hooks` directories are reserved for genuinely cross-feature
code. Features MUST NOT import another feature's internal files; they may use its public
exports or shared packages.

Rationale: stable domain boundaries allow teams to change frameworks and infrastructure
without rewriting business behavior or creating cross-team ownership conflicts.

### II. SOLID, Explicit Dependencies, and Simplicity

All production code MUST follow SOLID principles as testable design constraints:

- A module, class, hook, or component MUST have one cohesive reason to change.
- New behavior MUST use composition or explicit strategies when repeated conditionals would
  couple unrelated behavior.
- Implementations MUST honor the behavioral contracts of their interfaces and schemas.
- Consumers MUST depend on narrow interfaces, not broad service or repository surfaces.
- Domain and application code MUST depend on abstractions for external systems.

NestJS dependency injection MUST be used at module boundaries. React composition and hooks
MUST be preferred over inheritance. Files exceeding 400 logical lines, functions exceeding
60 logical lines, or constructors requiring more than five dependencies MUST be reviewed for
separation; exceptions require written PR justification.

Abstractions MUST solve demonstrated duplication, volatility, or boundary needs. Speculative
repositories, factories, generic helpers, and shared UI MUST NOT be introduced. Existing
patterns MUST be reused unless an Architecture Decision Record (ADR) explains the change.

Rationale: enterprise maintainability requires modularity without abstraction for its own
sake.

### III. Strict Type Safety and Shared Contracts

TypeScript strict mode MUST remain enabled for every workspace. New code MUST NOT use
`any`, `@ts-ignore`, unchecked casts, non-null assertions without a proven invariant, or
disabled lint rules without a local explanation. External input begins as `unknown` and MUST
be validated before use.

`packages/api-contracts` MUST become the source of truth for request schemas, response
schemas, error envelopes, pagination, and contract-derived TypeScript types. Zod schemas MUST
be executable by API and frontend consumers. `packages/shared-types` MUST hold only
framework-neutral primitives, branded units, identifiers, and enums. Frontends MUST NOT
redeclare API DTOs or trust unparsed response payloads.

Contracts MUST standardize success and error envelopes, ISO-8601 UTC timestamps, integer minor
units for money, meters for distance, seconds for duration, bounded pagination, stable error
codes, and contract version metadata. Breaking contracts require a migration plan,
compatibility window, consumer updates in the same change, and a versioned endpoint or
coordinated release. Prisma entities MUST NOT be public contracts by default.

Rationale: compile-time checks alone cannot prevent runtime drift across three independently
deployed applications.

### IV. Security, Privacy, and Authorization by Design

Security is a design input, not a release-stage task. Every endpoint MUST define
authentication, authorization, ownership, validation, abuse limits, audit behavior, and data
classification. The API is authoritative; frontend route or control guards are convenience
only.

Driver and admin identities MUST remain separate security realms with different secrets,
claims, refresh-token stores, guards, issuer/audience validation, and storage keys. Privileged
admin mutations MUST require explicit permissions, a reason where operationally meaningful,
and immutable audit records. Sensitive actions MUST require MFA or recent authentication.

Long-lived credentials MUST NOT be stored in `localStorage` in production. Refresh tokens
MUST use rotated, hashed, revocable sessions delivered through Secure, HttpOnly, SameSite
cookies where browser architecture permits. Cookie-authenticated mutations MUST implement
CSRF protection. Secrets, tokens, passwords, MFA material, private images, and personal data
MUST NOT appear in logs, analytics, fixtures, or source control.

All writes MUST enforce resource ownership or permission scope. Retryable writes MUST use
idempotency keys. Uploads MUST enforce size, MIME type, file signature, decompression limits,
retention, and deletion policy.

Rationale: Ehsbha processes identity, financial, operational, and administrative data with
materially different trust levels.

### V. Tested, Observable, and Operable Delivery

No feature is complete without automated evidence at the appropriate layers. Tests MUST be
written with or before implementation and MUST cover behavior rather than implementation
details. Bug fixes MUST include a regression test unless the PR explains why automation is
impossible.

Production paths MUST emit structured, privacy-safe logs with request or correlation IDs.
Critical workflows MUST expose metrics for volume, latency, errors, saturation, retries, and
job freshness. New scheduled jobs, provider integrations, migrations, and operational queues
MUST include failure handling, alerting expectations, and a runbook entry.

The repository MUST converge on one deterministic `npm run verify` command used locally and
in CI. It MUST include lint, strict type checks, unit tests, applicable integration and
contract tests, migration validation, and production builds. A failing required gate blocks
merge.

Rationale: code that cannot be verified, diagnosed, deployed, and recovered is not
production-grade.

## Architecture and Platform Rules

1. `apps/api`, `apps/web`, and `apps/admin` are independent deployment units.
2. `apps/web` and `apps/admin` MUST NOT import each other's source.
3. Frontends MUST NOT import NestJS, Prisma, server configuration, or backend-only code.
4. Shared packages MUST be independently typed, tested, documented, and free of application
   side effects.
5. Package dependencies MUST form an acyclic graph. CI MUST enforce forbidden imports and
   dependency cycles.
6. The API owns authorization, invariants, calculations, transactions, and persisted state.
   Clients may calculate previews only when server results remain authoritative.
7. Database access MUST remain inside API infrastructure. Controllers and UI components MUST
   NOT access Prisma or persistence adapters directly.
8. Cross-domain writes MUST use an application service with an explicit transaction boundary.
9. External providers MUST be behind adapters. Domain logic MUST be testable without network
   access.
10. Irreversible or cross-cutting decisions require an ADR with context, alternatives,
    consequences, owner, and date.
11. Every schema change requires a migration, indexes justified by access patterns,
    production-safe rollout notes, test-data impact, and rollback or forward-fix strategy.
12. Generated outputs, local logs, secrets, and `.env` files MUST NOT be committed.

## Frontend Engineering Rules

- React applications MUST use function components and hooks.
- New or materially changed feature code MUST live under `src/features/<feature>/`. Routes
  MAY reference legacy pages while migration is incremental.
- Route modules MUST be lazy-loaded except the minimal authentication and initial shell path.
- TanStack Query owns server state. Zustand owns only authentication/session state and
  intentionally shared client state. Server responses MUST NOT be duplicated into Zustand.
- Query keys MUST use feature-owned factories. Mutations MUST define cache invalidation or
  optimistic rollback behavior.
- Forms MUST use shared Zod schemas with React Hook Form where applicable.
- API access MUST pass through typed feature clients. Components MUST NOT call Axios directly.
- Components MUST include loading, empty, error, stale, offline, forbidden, and success states
  where applicable.
- Shared UI primitives MUST be accessible, theme-aware, direction-aware, and free of domain
  behavior. Feature components stay in their feature.
- Arabic and English copy MUST be complete. Layouts MUST support RTL and LTR using logical
  properties.
- Interactive UI MUST meet WCAG 2.1 AA: keyboard operation, visible focus, semantic labels,
  contrast, dialog focus management, reduced motion, and non-color status indicators.
- Client storage MUST be versioned, minimal, and explicitly classified as safe to persist.
- Raw provider, Axios, or stack messages MUST NOT be shown to users.
- Route and application error boundaries MUST provide recovery and sanitized reporting.

## Backend Engineering Rules

- Each NestJS feature MUST expose controllers as transport adapters, application use cases,
  domain logic, infrastructure adapters, contracts, and tests as needed.
- Controllers MUST remain thin: authenticate, authorize, validate, invoke one application
  operation, and map the result. Business rules MUST NOT live in controllers.
- Application services MUST not accept Express request/response objects.
- Prisma calls MUST be isolated from controllers and pure domain logic. Complex queries MUST
  use typed Prisma inputs; `any` in query construction is prohibited.
- Multi-record or aggregate writes MUST be atomic and explicitly transactional.
- Ownership filters MUST be included in reads and writes, not checked only after loading.
- Validation MUST use shared Zod contracts. Unknown fields MUST be rejected for sensitive
  mutations.
- Exceptions MUST map to stable error codes. Raw Prisma or provider messages MUST NOT cross
  the API boundary.
- Logs MUST be structured and include correlation ID, operation, outcome, and safe identifiers.
  `console.*` is prohibited except bootstrap-fatal handling.
- Configuration MUST be validated at startup. Production MUST fail fast on missing secrets or
  wildcard CORS.
- Liveness and readiness MUST be separate and MUST NOT expose internal topology.
- Background work MUST be idempotent, bounded, observable, retry-aware, and duplicate-safe.
- Admin endpoints MUST have a mechanically testable endpoint-to-permission mapping.

## Naming and Code Conventions

- Files and directories: `kebab-case`.
- React components, classes, types, interfaces, and enums: `PascalCase`.
- Functions, hooks, variables, and properties: `camelCase`; hooks start with `use`.
- Immutable configuration and protocol constants: `UPPER_SNAKE_CASE`.
- Boolean names MUST use `is`, `has`, `can`, `should`, or `was`.
- NestJS role suffixes are `.controller.ts`, `.service.ts`, `.module.ts`, `.repository.ts`,
  `.adapter.ts`, `.guard.ts`, `.pipe.ts`, and `.spec.ts`.
- Contract schemas use `<Operation><Resource>Schema`; inferred types use the same name without
  `Schema`.
- API paths use plural lowercase resources and kebab-case segments.
- Database tables/columns use `snake_case`; Prisma uses mapped `PascalCase`/`camelCase`.
- Dates end in `At` for instants and `On` for calendar dates. Numeric fields MUST include
  units, such as `amountPiastres`, `distanceMeters`, or `durationSeconds`.
- Error codes use `UPPER_SNAKE_CASE`; permissions use `<scope>.<action>`.
- Ambiguous names such as `data`, `item`, `manager`, `helper`, or `util` require narrower
  context or a more specific name.

## Testing and Quality Standards

Applicable layers MUST be selected by risk; omission requires PR justification:

- Unit tests: domain rules, calculations, validation, reducers, formatters, transitions.
- API integration tests: controllers, guards, ownership, transactions, Prisma behavior,
  idempotency, scheduled work, and error mapping, using PostgreSQL where behavior depends on it.
- Contract tests: requests, responses, errors, pagination, units, dates, and shared schemas.
- Component tests: forms, permissions, loading/error/empty states, accessibility, interactions.
- E2E tests: critical driver journeys, admin role journeys, authentication, OCR, offline retry,
  and cross-application effects.
- Security tests: realm confusion, privilege escalation, ownership bypass, refresh replay,
  CSRF, XSS, injection, upload abuse, rate limits, and redaction.

Changed domain/application code MUST achieve at least 90% branch coverage; changed
infrastructure and UI logic MUST achieve at least 80%. Critical authentication,
authorization, money, aggregate, and migration paths MUST cover happy and material failure
paths completely.

Tests MUST be deterministic, isolated, parallel-safe where supported, and independent of
production services. Flaky tests are failures and MUST be fixed or quarantined with an owner,
issue, and expiry date. Snapshots MUST NOT replace behavioral assertions.

## Performance and Scalability Budgets

- API reads: p95 <= 300 ms and p99 <= 750 ms, excluding documented provider latency.
- API writes: p95 <= 500 ms and p99 <= 1,000 ms, excluding asynchronous work.
- Error rate: < 1% over five minutes; critical path target < 0.1%.
- Database reads MUST be bounded and paginated. Routine requests SHOULD use no more than
  10 database round trips and MUST avoid N+1 queries.
- Initial web route: compressed first-party JavaScript <= 250 KiB; CSS <= 75 KiB.
- Lazy route chunk: compressed JavaScript <= 150 KiB unless an approved exception includes
  bundle evidence.
- Core Web Vitals at p75 on representative mobile hardware: LCP <= 2.5 s, INP <= 200 ms,
  CLS <= 0.1.
- Admin route shell <= 3 s on a standard office connection; filter feedback <= 100 ms while
  network work remains cancelable and visibly pending.
- Uploads and batches MUST have explicit payload, item-count, time, and memory limits.
- Work expected to exceed two seconds MUST use bounded background jobs with progress and retry
  visibility.

Regressions beyond 10% or budget violations block merge unless an owner approves a
time-bounded exception with measurement, impact, and remediation issue.

## Security Standards

- Follow OWASP ASVS Level 2; administrative and authentication controls MUST meet relevant
  Level 3 requirements where practical.
- Passwords MUST use Argon2id with reviewed parameters. Tokens and recovery codes MUST be
  hashed when plaintext lookup is unnecessary.
- JWTs MUST validate algorithm, issuer, audience, expiry, subject, token type, realm, and
  session or permission version as applicable.
- Admin MFA MUST use standards-based TOTP or stronger. Pattern-only MFA is forbidden.
- Rate limits MUST cover authentication, reset, OCR/upload, exports, bulk operations, and
  expensive analytics.
- Production CORS MUST use explicit origins. CSP, HSTS, secure headers, proxy settings, and
  cookie flags MUST be environment-tested.
- Dependencies MUST be lockfile-pinned and scanned. Exploitable critical/high findings block
  release; accepted risk requires an owner and expiry.
- CI MUST run secret scanning and static analysis. Leaked credentials MUST be rotated.
- Personal data MUST have documented purpose, retention, access, export, correction, and
  deletion behavior.
- Backups MUST be encrypted and restoration tested.

## Git and Pull Request Standards

- `main` MUST remain releasable and protected from direct feature pushes.
- Branches use `<type>/<issue-or-spec>-<short-kebab-description>`.
- Commits MUST be focused and use Conventional Commits.
- Every PR MUST link a specification, issue, or incident unless it is a trivial docs fix.
- PRs SHOULD remain below 500 changed logical lines. Larger changes require decomposition
  rationale and reviewer plan; generated files and migrations are excluded.
- Contract, migration, and shared-package changes MUST identify affected consumers and
  deployment ordering.
- Required CI MUST pass. Authors MUST resolve review threads and re-request review after
  material changes.
- At least one qualified reviewer is required; security, migration, shared contract, and
  cross-application changes require a relevant code owner or second reviewer.
- Squash merge is the default. The final commit MUST describe delivered behavior.
- Emergency changes require an incident reference, post-deploy verification, and follow-up
  review within one business day.

## Pull Request Review Checklist

- [ ] Requirement, feature owner, and scope are clear.
- [ ] Dependency direction and feature boundaries comply.
- [ ] Business logic is outside controllers, UI, and persistence adapters.
- [ ] Shared contracts are authoritative, runtime-validated, and updated for all consumers.
- [ ] Types are strict with no unjustified `any`, ignores, casts, or disabled rules.
- [ ] Authentication, authorization, ownership, validation, idempotency, audit, and limits
      are correct.
- [ ] Migration, indexes, compatibility, deployment order, and recovery are addressed.
- [ ] UI states, accessibility, i18n, RTL, responsive, and offline behavior are covered.
- [ ] Tests cover happy, edge, failure, regression, and applicable contract paths.
- [ ] Logs and metrics are correlated and free of secrets or personal data.
- [ ] Performance budgets are measured or demonstrably unaffected.
- [ ] Documentation, ADRs, runbooks, and environment examples match the change.
- [ ] The PR contains no unrelated refactor or generated noise.

## Definition of Done

1. Acceptance criteria, edge cases, data rules, and non-functional requirements are explicit.
2. Clean Architecture boundaries and SOLID responsibilities are demonstrated.
3. Shared contracts, stable errors, units, dates, and pagination are used by every consumer.
4. Authorization, ownership, validation, idempotency, audit, privacy, and threats are handled.
5. Migrations, constraints, indexes, test data, rollout, and recovery notes are complete.
6. UI surfaces include applicable interaction/failure states, localization, RTL,
   accessibility, and responsive behavior.
7. Required unit, integration, contract, component, E2E, security, and performance tests pass.
8. Typecheck, lint, tests, migrations, and production builds pass through the CI verification
   command.
9. Metrics, logs, alerts, dashboards, and runbooks exist for critical behavior.
10. Documentation and ADRs describe the shipped system, not an intended or obsolete design.
11. Required reviewers approve and no critical/high correctness or security issue remains.
12. Deployment, recovery, and post-deploy verification are defined.

## Governance

This constitution supersedes conflicting conventions in plans, architecture documents, code,
templates, and team habits. Existing code is not automatically compliant, but every touched
area MUST move toward compliance and MUST NOT increase known debt without an approved,
time-bounded exception.

Amendments require a PR with motivation, affected principles, migration impact, alternatives,
technical-owner approval, affected-application review, dependent template updates, and a
semantic version change. MAJOR removes or incompatibly redefines guarantees; MINOR adds or
materially expands obligations; PATCH clarifies without changing obligations. The amendment
MUST update the ISO date and Sync Impact Report.

Every feature plan MUST complete the Constitution Check before research and after design.
Every PR MUST apply the review checklist. Exceptions MUST name the violated rule, reason,
risk, compensating controls, owner, remediation issue, and expiry date. Expired exceptions
block merge and release.

The engineering lead MUST review compliance quarterly and before production launch. Repeated
violations MUST result in tooling, template, or CI enforcement.

**Version**: 1.0.0 | **Ratified**: 2026-06-07 | **Last Amended**: 2026-06-07
