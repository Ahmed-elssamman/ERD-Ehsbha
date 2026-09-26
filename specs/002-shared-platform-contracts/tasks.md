# Tasks: Shared Platform Foundation and API Contracts

**Input**: Design documents from `specs/002-shared-platform-contracts/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Tests are mandatory for every behavior in this feature. Write the named tests before
the implementation task they protect, run them once to confirm the intended failure, then make
them pass. Do not replace behavioral assertions with snapshots.

**Organization**: Tasks are grouped by user story. Execute tasks in numeric order unless a task is
marked `[P]` and all of its stated prerequisites are complete.

## Execution Rules for a Lower-Capability Model

1. Read the referenced design artifact and every existing target file before editing.
2. Work on one task only. Do not implement later task scope early.
3. Preserve current product behavior unless the task explicitly normalizes a contract.
4. Do not redesign authentication, add billing, add offline sync behavior, or complete scaffold
   features.
5. Keep API, driver web, and admin security realms separate.
6. Do not create local DTO or response interfaces after a domain has moved to
   `packages/api-contracts`.
7. Keep generated catalog and OpenAPI output under `verification-output/contracts/`; do not commit
   generated files as source.
8. Run the command named by the task or phase checkpoint. Check the task only after it passes.
9. When a task changes a public contract, update its catalog entry and all listed consumers in the
   same task.
10. Stop at a failed checkpoint and fix the failure before continuing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: May run in parallel because it writes different files and has no incomplete dependency.
- **[Story]**: Maps the task to a specification user story.
- Every task names exact files and an acceptance or verification action.

---

## Phase 1: Setup (Shared Package and Tooling Skeleton)

**Purpose**: Create buildable workspace shells and install the exact tooling required by the plan.

- [x] T001 Verify the implementation branch against `specs/002-shared-platform-contracts/plan.md`; before editing source files, create or switch to a feature branch named `feature/002-shared-platform-contracts` from the current HEAD if still on `001-baseline-governance`, then confirm `git status --short` preserves all existing planning changes
- [x] T002 [P] Create the `@ehsbha/shared-types` workspace shell in `packages/shared-types/package.json`, `packages/shared-types/tsconfig.json`, `packages/shared-types/tsconfig.cjs.json`, `packages/shared-types/tsconfig.esm.json`, and `packages/shared-types/src/index.ts` with strict composite builds, CJS/ESM/declaration outputs, sideEffects false, and no runtime dependencies
- [x] T003 [P] Create the `@ehsbha/api-contracts` workspace shell in `packages/api-contracts/package.json`, `packages/api-contracts/tsconfig.json`, `packages/api-contracts/tsconfig.cjs.json`, `packages/api-contracts/tsconfig.esm.json`, and `packages/api-contracts/src/index.ts` with dependencies only on Zod, `@ehsbha/shared-types`, and `@asteasolutions/zod-to-openapi@7.3.4`, strict composite builds, and explicit subpath export placeholders
- [x] T004 [P] Create the `@ehsbha/eslint-config` workspace shell in `packages/eslint-config/package.json` and `packages/eslint-config/index.mjs` as an ESM package with no application imports
- [x] T005 [P] Create the `@ehsbha/ui-tokens` workspace shell in `packages/ui-tokens/package.json`, `packages/ui-tokens/tsconfig.json`, and `packages/ui-tokens/src/index.ts` with sideEffects false and no React, router, auth, or domain dependencies
- [x] T006 Add the package build graph in `tsconfig.packages.json` and root `tsconfig.json`, referencing `packages/shared-types`, `packages/api-contracts`, and `packages/ui-tokens` in dependency order without changing application compiler modes
- [x] T007 [P] Add `@ehsbha/shared-types` and `@ehsbha/api-contracts` workspace dependencies plus package-aware typecheck/build scripts to `apps/api/package.json`
- [x] T008 [P] Add `@ehsbha/shared-types`, `@ehsbha/api-contracts`, and `@ehsbha/ui-tokens` workspace dependencies plus Vitest unit-test scripts to `apps/web/package.json`
- [x] T009 [P] Add `@ehsbha/shared-types`, `@ehsbha/api-contracts`, `@ehsbha/ui-tokens`, and Vitest unit-test scripts to `apps/admin/package.json`
- [x] T010 Add root scripts `packages:build`, `packages:typecheck`, `packages:test`, `web:test`, `admin:test`, `contracts:generate`, `contracts:inventory`, `verify:contracts`, `verify:boundaries`, and `verify:frontend-isolation` plus lockfile-pinned dev dependencies for Vitest, dependency-cruiser, and `@ehsbha/eslint-config` in `package.json`
- [x] T011 Run `npm install` after T002-T010 and commit only the resulting workspace/dependency changes in `package-lock.json`; verify `npm ci --ignore-scripts` resolves all four package workspaces without stale entries

**Checkpoint**: Run `npm ci --ignore-scripts` and `npm run packages:typecheck`; package shells must
resolve before foundational code begins.

---

## Phase 2: Foundational (Blocking Contract Primitives)

**Purpose**: Implement the shared primitives every user story depends on.

**CRITICAL**: No user story task may begin until T012-T025 pass.

- [x] T012 [P] Implement the reusable opaque brand helper and safe conversion functions in `packages/shared-types/src/brand.ts` without runtime framework dependencies
- [x] T013 [P] Implement integer unit types and guards for `MoneyPiastres`, `DistanceMeters`, and `DurationSeconds` in `packages/shared-types/src/units.ts`, rejecting non-safe integers and preserving zero
- [x] T014 [P] Implement branded driver/admin/domain identifiers, locale values, IANA timezone validation helpers, UTC instant validation, and calendar-date validation in `packages/shared-types/src/identifiers.ts`, `packages/shared-types/src/locale.ts`, and `packages/shared-types/src/time.ts`
- [x] T015 Export only the approved public primitives from `packages/shared-types/src/index.ts` and add tests for brands, safe integers, UTC offsets, invalid calendar dates, locales, and timezones in `packages/shared-types/src/shared-types.spec.ts`
- [x] T016 [P] Define `API_VERSION = 'v1'`, `CONTRACT_VERSION = '1.0.0'`, supported major version 1, semantic-version parsing, and compatibility helpers in `packages/api-contracts/src/core/version.ts`
- [x] T017 [P] Define passthrough `ResponseMetaSchema`, generic success envelope helpers, explicit empty-success data, and response-header constants from `contracts/platform-http.md` in `packages/api-contracts/src/core/envelope.ts`
- [x] T018 [P] Define `FieldIssueSchema`, `FailureEnvelopeSchema`, normalized error categories, retry policies, and the complete governed error registry from `contracts/error-catalog.md` in `packages/api-contracts/src/core/errors.ts`
- [x] T019 [P] Define strict cursor/offset request schemas, cursor/offset page metadata schemas, default 25, maximum 100, and approved-exception metadata in `packages/api-contracts/src/core/pagination.ts`
- [x] T020 [P] Define typed `ContractDefinition`, `ContractCatalogEntry`, `ConsumerBinding`, `IdempotencyPolicy`, and operation registration helpers matching `contracts/contract-catalog.schema.json` in `packages/api-contracts/src/catalog/types.ts` and `packages/api-contracts/src/catalog/registry.ts`
- [x] T021 Implement framework-neutral success/failure parsing, contract-major rejection, unknown error-code normalization, and redacted schema issue summaries in `packages/api-contracts/src/core/parse-response.ts`
- [x] T022 Implement the Zod-to-OpenAPI registry bootstrap and schema naming helpers in `packages/api-contracts/src/openapi/registry.ts`, pinned to Zod 3 behavior and importing no NestJS decorators
- [x] T023 [P] Implement application-neutral color, typography, spacing, motion, and direction-safe tokens in `packages/ui-tokens/src/colors.ts`, `packages/ui-tokens/src/typography.ts`, `packages/ui-tokens/src/spacing.ts`, `packages/ui-tokens/src/motion.ts`, and `packages/ui-tokens/src/index.ts`
- [x] T024 Add test-first coverage for strict request objects, passthrough response objects, envelopes, errors, versions, pagination bounds, and parse failures in `packages/api-contracts/src/core/core-contracts.spec.ts`
- [x] T025 Complete package export maps and build scripts in `packages/shared-types/package.json`, `packages/api-contracts/package.json`, and `packages/ui-tokens/package.json`; run `npm run packages:build`, `npm run packages:typecheck`, and `npm run packages:test`

**Checkpoint**: Shared packages build in both module formats, core tests pass, and no shared package
imports application, browser-state, NestJS, Prisma, Axios, or provider code.

---

## Phase 3: User Story 1 - Consume One Authoritative Contract (Priority: P1) MVP

**Goal**: Every active request and response has one executable shared definition used by the API
and all active clients, with a complete route/consumer catalog.

**Independent Test**: Run `npm run verify:contracts`; every active controller route and active
web/admin call must map to one catalog entry, representative valid/invalid payloads must agree
across producer and consumers, and local competing response definitions must be zero.

### Tests for User Story 1

- [x] T026 [P] [US1] Write failing auth/profile contract tests for strict requests, passthrough responses, driver/admin realm separation, and invalid identifiers in `packages/api-contracts/src/domains/auth-profile.spec.ts`
- [x] T027 [P] [US1] Write failing vehicle/app/area contract tests for units, enums, nullability, and create/update distinctions in `packages/api-contracts/src/domains/vehicle-app-area.spec.ts`
- [x] T028 [P] [US1] Write failing trip/OCR contract tests for UTC instants, piastres/meters/seconds, partial batch errors, upload hints, confidence bounds, and additive OCR fields in `packages/api-contracts/src/domains/trip-ocr.spec.ts`
- [x] T029 [P] [US1] Write failing expense/fuel/maintenance/odometer/session/goal contract tests for units, date fields, statuses, nullability, and list pagination in `packages/api-contracts/src/domains/operations.spec.ts`
- [x] T030 [P] [US1] Write failing analytics/recommendation/score/forecast contract tests for numeric units, optional aggregates, date buckets, and stable result shapes in `packages/api-contracts/src/domains/analytics-intelligence.spec.ts`
- [x] T031 [P] [US1] Write failing community/review/support/notification contract tests for enums, public/private fields, cursor pages, moderation-safe fields, and notification payload safety in `packages/api-contracts/src/domains/communications.spec.ts`
- [x] T032 [P] [US1] Write failing admin auth/user/driver/trip/vehicle contract tests for realm-specific codes, table query fields, permissions, reason fields, and private-field exclusion in `packages/api-contracts/src/domains/admin-core.spec.ts`
- [x] T033 [P] [US1] Write failing admin moderation/support/audit/roles/settings/analytics/health contract tests for list queries, bulk partial failures, reason codes, audit records, settings values, and scaffold lifecycle metadata in `packages/api-contracts/src/domains/admin-operations.spec.ts`

### Shared Contract Implementation for User Story 1

- [x] T034 [P] [US1] Implement driver auth, password-reset, user profile, driver profile, and admin auth request/response schemas plus operation entries in `packages/api-contracts/src/domains/auth-profile.ts` until T026 passes
- [x] T035 [P] [US1] Implement vehicle, vehicle-cost, app-source, driver-app, and area schemas plus operation entries in `packages/api-contracts/src/domains/vehicle-app-area.ts` until T027 passes
- [x] T036 [P] [US1] Implement trip CRUD/batch, canonical money fields, OCR request/result, and OCR warning schemas plus operation entries in `packages/api-contracts/src/domains/trip-ocr.ts` until T028 passes
- [x] T037 [P] [US1] Implement expense, fuel, maintenance, odometer, session, and goal schemas plus operation entries in `packages/api-contracts/src/domains/operations.ts` until T029 passes
- [x] T038 [P] [US1] Implement analytics, forecast, recommendation, decision, score, and progress schemas plus operation entries in `packages/api-contracts/src/domains/analytics-intelligence.ts` until T030 passes
- [x] T039 [P] [US1] Implement community, review, support, notification, public-review, and daily-digest schemas plus operation entries in `packages/api-contracts/src/domains/communications.ts` until T031 passes
- [x] T040 [P] [US1] Implement admin auth, users, drivers, trips, vehicles, dashboard, and bulk-result schemas plus operation entries in `packages/api-contracts/src/domains/admin-core.ts` until T032 passes
- [x] T041 [P] [US1] Implement admin moderation, support, notifications, audit, roles, permissions, admins, settings, analytics, revenue-scaffold, health, OCR-scaffold, and feature-usage schemas plus operation entries in `packages/api-contracts/src/domains/admin-operations.ts` until T033 passes
- [x] T042 [P] [US1] Implement health, readiness, sync pull/push, device-token, maintenance-catalog, and other active non-page operation schemas plus operation entries in `packages/api-contracts/src/domains/platform-operations.ts`
- [x] T043 [US1] Aggregate domain exports and all operation registrations without duplicate operation IDs in `packages/api-contracts/src/domains/index.ts`, `packages/api-contracts/src/catalog/operations.ts`, and `packages/api-contracts/src/index.ts`

### API Adoption for User Story 1

- [ ] T044 [P] [US1] Replace local auth/user/driver request schemas with shared imports or compatibility re-exports in `apps/api/src/modules/auth/dto/auth.dto.ts`, `apps/api/src/modules/auth/auth.controller.ts`, `apps/api/src/modules/users/users.controller.ts`, and `apps/api/src/modules/drivers/drivers.controller.ts`; preserve service behavior and run `npm run api:typecheck`
- [ ] T045 [P] [US1] Replace local vehicle/app/area request schemas with shared imports or compatibility re-exports in `apps/api/src/modules/vehicles/dto/vehicles.dto.ts`, `apps/api/src/modules/vehicles/vehicles.controller.ts`, `apps/api/src/modules/apps/dto/apps.dto.ts`, `apps/api/src/modules/apps/apps.controller.ts`, and `apps/api/src/modules/areas/areas.controller.ts`
- [ ] T046 [P] [US1] Replace local trip/OCR schemas with shared imports or compatibility re-exports in `apps/api/src/modules/trips/dto/trips.dto.ts`, `apps/api/src/modules/trips/trips.controller.ts`, `apps/api/src/modules/ocr/dto/ocr.dto.ts`, and `apps/api/src/modules/ocr/ocr.controller.ts`
- [ ] T047 [P] [US1] Apply shared request/query schemas to `apps/api/src/modules/expenses/expenses.controller.ts`, `apps/api/src/modules/fuel/fuel.controller.ts`, `apps/api/src/modules/maintenance/maintenance.controller.ts`, `apps/api/src/modules/odometer/odometer.controller.ts`, `apps/api/src/modules/sessions/sessions.controller.ts`, and `apps/api/src/modules/goals/goals.controller.ts`
- [ ] T048 [P] [US1] Apply shared request/query and documented response schemas to `apps/api/src/modules/analytics/analytics.controller.ts`, `apps/api/src/modules/recommendations/recommendations.controller.ts`, and `apps/api/src/modules/score/score.controller.ts`
- [ ] T049 [P] [US1] Apply shared request/query schemas to `apps/api/src/modules/community/community.controller.ts`, `apps/api/src/modules/reviews/reviews.controller.ts`, `apps/api/src/modules/support/support.controller.ts`, and `apps/api/src/modules/notifications/notifications.controller.ts`
- [ ] T050 [P] [US1] Apply shared admin auth/user/driver schemas to `apps/api/src/modules/admin/admin-auth.controller.ts`, `apps/api/src/modules/admin/admin-users.controller.ts`, `apps/api/src/modules/admin/admin-drivers.controller.ts`, and `apps/api/src/modules/admin/admin-bulk.controller.ts`
- [ ] T051 [P] [US1] Apply shared admin trip/vehicle/moderation schemas to `apps/api/src/modules/admin/admin-trips.controller.ts`, `apps/api/src/modules/admin/admin-vehicles.controller.ts`, `apps/api/src/modules/admin/admin-community.controller.ts`, and `apps/api/src/modules/admin/admin-reviews.controller.ts`
- [ ] T052 [P] [US1] Apply shared admin support/audit/roles/settings/analytics/notification/misc schemas to `apps/api/src/modules/admin/admin-support.controller.ts`, `apps/api/src/modules/admin/admin-audit.controller.ts`, `apps/api/src/modules/admin/admin-management.controller.ts`, `apps/api/src/modules/admin/admin-roles.controller.ts`, `apps/api/src/modules/admin/admin-settings.controller.ts`, `apps/api/src/modules/admin/admin-analytics.controller.ts`, `apps/api/src/modules/admin/admin-notifications.controller.ts`, `apps/api/src/modules/admin/admin-dashboard.controller.ts`, and `apps/api/src/modules/admin/admin-misc.controller.ts`

### Existing Client Adoption for User Story 1

- [ ] T053 [US1] Replace driver-local auth/profile/vehicle/app/area interfaces with shared schema imports and schema-validated response parsing in the corresponding sections of `apps/web/src/lib/api/endpoints.ts`; preserve exported API object names so current pages continue compiling
- [ ] T054 [P] [US1] Replace all OCR-local DTO types and unchecked parsing with shared OCR schemas in `apps/web/src/lib/api/ocr.api.ts`, then update type imports in `apps/web/src/hooks/use-ocr-extract.ts`, `apps/web/src/lib/ocr/ocr-to-trip.ts`, `apps/web/src/lib/ocr/parsed-to-form.ts`, and `apps/web/src/components/ocr/`
- [ ] T055 [US1] Replace driver-local trip/expense/fuel/maintenance/goal/analytics/recommendation/score contracts with shared imports and schema-validated parsing in the corresponding sections of `apps/web/src/lib/api/endpoints.ts`
- [ ] T056 [US1] Replace driver-local community/review/support/notification/public-review contracts with shared imports and schema-validated parsing in the corresponding sections of `apps/web/src/lib/api/endpoints.ts`
- [ ] T057 [P] [US1] Replace `apps/admin/src/lib/contracts/admin-auth.ts` definitions with shared re-exports and update `apps/admin/src/pages/login.tsx` to parse the shared login/MFA schemas without changing the current auth flow
- [ ] T058 [US1] Replace untyped `r.data` calls and local `CursorPage` with shared operation schemas throughout `apps/admin/src/lib/api/endpoints.ts`, preserving current exported client object names until User Story 3 moves them into feature folders

### Catalog Generation and Coverage for User Story 1

- [x] T059 [US1] Implement deterministic catalog, OpenAPI, controller-route inventory, and frontend-call inventory commands in `scripts/contracts/generate-catalog.mjs`, `scripts/contracts/generate-openapi.mjs`, `scripts/contracts/inventory-consumers.mjs`, and `scripts/contracts/verify-contracts.mjs`, writing output only to `verification-output/contracts/`
- [ ] T060 [US1] Add repository tests for 100% active route coverage, active consumer coverage, unique method/path and operation IDs, lifecycle owner/follow-up rules, zero competing local response definitions, deterministic generation, and catalog JSON Schema validation in `scripts/verification/tests/contract-catalog.test.mjs` and `scripts/verification/tests/contract-consumers.test.mjs`; replace the Phase 0 contract placeholder in `apps/api/package.json`, `package.json`, and `scripts/verification/verify.mjs`, then run `npm run verify:contracts`

**Checkpoint**: User Story 1 is complete when `npm run verify:contracts`, `npm run api:typecheck`,
`npm run web:typecheck`, and `npm run admin:typecheck` pass with 100% active catalog coverage and
zero competing local response definitions.

---

## Phase 4: User Story 2 - Receive Consistent Platform Responses and Errors (Priority: P1)

**Goal**: Every API result uses one envelope, request identity, version metadata, governed error
mapping, unit convention, and bounded pagination behavior.

**Independent Test**: Exercise representative success, validation, authentication, authorization,
not-found, conflict, throttling, provider, and unexpected outcomes across five driver and five
admin domains; assert identical envelope/meta/error rules and sanitized diagnostics.

### Tests for User Story 2

- [ ] T061 [P] [US2] Write failing request-context tests for inbound ID validation, generated UUIDs, response headers, and privacy-safe logging context in `apps/api/src/common/middleware/request-context.middleware.spec.ts`
- [ ] T062 [P] [US2] Write failing success-envelope and metadata tests for JSON, explicit empty success, server time, API version, contract version, and passthrough operation data in `apps/api/src/common/interceptors/transform-response.interceptor.spec.ts`
- [ ] T063 [P] [US2] Write failing failure-envelope tests for governed codes, field issues, request ID correlation, Prisma/provider sanitization, and no raw stack/credential output in `apps/api/src/common/filters/exception.filter.spec.ts`
- [ ] T064 [P] [US2] Write failing strict request and pagination tests for unknown body/query fields, omitted limit 25, accepted limit 100, rejected limit 101, empty pages, and invalid cursor binding in `apps/api/src/common/pipes/zod.pipe.spec.ts` and `apps/api/src/common/contracts/pagination.spec.ts`
- [ ] T065 [P] [US2] Write failing cross-domain HTTP agreement tests for auth, trips, OCR, reviews, support, admin users, admin trips, admin audit, admin settings, and admin health in `apps/api/src/common/contracts/platform-http.integration.spec.ts`

### Implementation for User Story 2

- [x] T066 [US2] Implement request-context types and privacy-safe request ID validation in `apps/api/src/common/contracts/request-context.ts` and `apps/api/src/common/middleware/request-context.middleware.ts` until T061 passes
- [ ] T067 [US2] Register request-context middleware before controllers and export it for tests in `apps/api/src/app.module.ts`
- [x] T068 [US2] Refactor `apps/api/src/common/interceptors/transform-response.interceptor.ts` to use shared envelope/meta/version contracts, set `X-Request-Id`, `X-Api-Version`, and `X-Contract-Version`, and avoid double-wrapping documented envelopes until T062 passes
- [x] T069 [US2] Refactor `apps/api/src/common/filters/exception.filter.ts` to map only governed codes, include shared metadata and headers, preserve request ID, sanitize Prisma/provider/unexpected failures, and log structured safe fields until T063 passes
- [x] T070 [US2] Refactor `apps/api/src/common/pipes/zod.pipe.ts` to preserve shared strict schemas, normalize `ZodError` issues to `FieldIssueSchema`, and never expose rejected values until the strict-request assertions in T064 pass
- [ ] T071 [US2] Update global bootstrap wiring in `apps/api/src/main.ts` so request context, response interception, exception mapping, content limits, and CORS behavior remain in the documented order without changing authentication
- [ ] T072 [US2] Add a static strictness audit in `scripts/contracts/verify-request-strictness.mjs` and `scripts/verification/tests/request-strictness.test.mjs` that fails when any registered JSON body/query object accepts or strips unknown fields
- [ ] T073 [P] [US2] Normalize driver/public pagination defaults, maximums, page metadata, and stable sort/cursor binding in `apps/api/src/modules/trips/trips.controller.ts`, `apps/api/src/modules/trips/trips.service.ts`, `apps/api/src/modules/community/community.controller.ts`, `apps/api/src/modules/community/community.service.ts`, `apps/api/src/modules/reviews/reviews.controller.ts`, `apps/api/src/modules/reviews/reviews.service.ts`, `apps/api/src/modules/support/support.controller.ts`, `apps/api/src/modules/support/support.service.ts`, and `apps/api/src/modules/notifications/notifications.controller.ts`
- [ ] T074 [P] [US2] Normalize admin table pagination defaults, maximums, page metadata, stable sorting, filters, and export eligibility in `apps/api/src/modules/admin/admin-users.controller.ts`, `admin-users.service.ts`, `admin-drivers.controller.ts`, `admin-drivers.service.ts`, `admin-trips.controller.ts`, `admin-trips.service.ts`, `admin-vehicles.controller.ts`, `admin-vehicles.service.ts`, `admin-community.controller.ts`, `admin-reviews.controller.ts`, `admin-support.controller.ts`, `admin-audit.controller.ts`, and their paired service files under `apps/api/src/modules/admin/`
- [ ] T075 [US2] Implement an error-code inventory that compares thrown/mapped API codes with the governed registry in `scripts/contracts/inventory-error-codes.mjs` and `scripts/verification/tests/error-catalog.test.mjs`
- [ ] T076 [P] [US2] Replace ad hoc driver-domain HTTP exception codes/messages with governed error definitions while preserving status and behavior in service files under `apps/api/src/modules/auth/`, `trips/`, `ocr/`, `vehicles/`, `community/`, `reviews/`, `support/`, and `notifications/`
- [ ] T077 [P] [US2] Replace ad hoc admin-domain HTTP exception codes/messages with governed realm-specific definitions while preserving permission and audit behavior in service files under `apps/api/src/modules/admin/`
- [ ] T078 [P] [US2] Add request-ID and envelope agreement integration assertions for at least five driver domains in `apps/api/src/common/contracts/driver-http-agreement.integration.spec.ts`
- [ ] T079 [US2] Add request-ID and envelope agreement integration assertions for at least five admin domains, run the security redaction assertions, and make the entire User Story 2 suite pass in `apps/api/src/common/contracts/admin-http-agreement.integration.spec.ts`

**Checkpoint**: Run `npm run api:test -- --runInBand`, `npm run test:integration`, and
`npm run verify:contracts`; every sampled response must contain matching request/version metadata
and no unsafe details.

---

## Phase 5: User Story 3 - Use Predictable Client Data Behavior (Priority: P2)

**Goal**: Driver and admin clients parse contracts, classify outcomes, retry safely, invalidate
stable query keys, and prevent duplicate write effects consistently.

**Independent Test**: Client unit tests prove parsing and retry matrices for both realms, while API
integration tests prove same-key replay, changed-payload conflict, concurrent duplicate handling,
and cross-actor/cross-realm isolation.

### Tests for User Story 3

- [ ] T080 [P] [US3] Write failing driver client tests for schema parsing, request ID preservation, unsupported major rejection, unknown error-code handling, safe-read retries, `Retry-After`, non-retry outcomes, and refresh isolation in `apps/web/src/features/platform-api/platform-api.spec.ts`
- [ ] T081 [P] [US3] Write failing admin client tests for schema parsing, forbidden, stale permissions, MFA required, session expired, safe-read retries, and contract mismatch without clearing valid auth in `apps/admin/src/features/platform-api/platform-api.spec.ts`
- [ ] T082 [P] [US3] Write failing canonical request hashing and idempotency state-transition unit tests in `apps/api/src/modules/idempotency/idempotency.service.spec.ts`
- [ ] T083 [P] [US3] Write failing PostgreSQL migration/repository tests for composite uniqueness, expiry index, actor/realm isolation, and completed-state constraints in `apps/api/src/modules/idempotency/idempotency.repository.integration.spec.ts`
- [ ] T084 [P] [US3] Write failing interceptor security tests proving validation/auth/ownership happen before key claim and replay payloads reject credentials, tokens, MFA material, raw OCR images, and oversized bodies in `apps/api/src/common/interceptors/idempotency.interceptor.spec.ts`
- [ ] T085 [P] [US3] Write failing end-to-end duplicate-write tests for same key/same payload replay, same key/different payload conflict, concurrent duplicate, lost response retry, and exactly one trip business effect in `apps/api/src/modules/idempotency/idempotency.e2e.spec.ts`

### Idempotency Implementation for User Story 3

- [ ] T086 [US3] Add `IdempotencyStatus` and `IdempotencyRecord` with the exact fields, unique scope, indexes, and constraints from `data-model.md` to `apps/api/prisma/schema.prisma`, then create additive migration `apps/api/prisma/migrations/20260611000000_add_idempotency_records/migration.sql` with rollback/forward-fix notes in `apps/api/prisma/migrations/20260611000000_add_idempotency_records/README.md`
- [ ] T087 [US3] Implement typed Prisma persistence methods for claim, load, complete, mark retryable failure, and expire records in `apps/api/src/modules/idempotency/idempotency.repository.ts`
- [ ] T088 [US3] Implement canonical validated-request hashing, state transitions, 24-hour default retention, replay result bounds, and governed conflicts in `apps/api/src/modules/idempotency/idempotency.service.ts` until T082 and T083 pass
- [ ] T089 [US3] Implement `@IdempotentOperation()` metadata, key validation, actor/realm/operation scoping, response replay, and transient-failure handling in `apps/api/src/common/decorators/idempotent-operation.decorator.ts`, `apps/api/src/common/interceptors/idempotency.interceptor.ts`, and `apps/api/src/modules/idempotency/idempotency.module.ts` until T084 passes
- [ ] T090 [US3] Register `IdempotencyModule` and the interceptor dependencies without making them global for undeclared operations in `apps/api/src/app.module.ts`
- [ ] T091 [P] [US3] Declare and apply idempotency policies to duplicate-sensitive driver writes in `packages/api-contracts/src/domains/vehicle-app-area.ts`, `trip-ocr.ts`, `operations.ts`, and `communications.ts` plus the matching controllers under `apps/api/src/modules/vehicles/`, `apps/`, `areas/`, `trips/`, `sessions/`, `fuel/`, `expenses/`, `maintenance/`, `odometer/`, `goals/`, `community/`, `reviews/`, and `support/`; exclude auth/token and OCR upload operations
- [ ] T092 [P] [US3] Declare and apply idempotency policies to duplicate-sensitive admin mutations in `packages/api-contracts/src/domains/admin-core.ts`, `admin-operations.ts`, and matching controllers under `apps/api/src/modules/admin/`, preserving existing permission checks, reason requirements, and audit records

### Driver Client Implementation for User Story 3

- [x] T093 [US3] Implement the driver realm Axios adapter, shared-envelope parser adapter, normalized error type, retry classifier, `Retry-After` parser, idempotency-key helper, and test exports in `apps/web/src/features/platform-api/client.ts`, `parse.ts`, `errors.ts`, `retry.ts`, `idempotency.ts`, and `index.ts` until T080 passes
- [ ] T094 [US3] Move auth/profile/vehicle/app/area clients and query-key factories into `apps/web/src/features/auth/api.ts`, `apps/web/src/features/profile/api.ts`, `apps/web/src/features/vehicles/api.ts`, `apps/web/src/features/apps/api.ts`, and `apps/web/src/features/areas/api.ts`; update imports in `apps/web/src/pages/auth/`, `apps/web/src/pages/settings/settings.tsx`, `apps/web/src/hooks/use-vehicle-selector.ts`, `apps/web/src/pages/simulator/simulator.tsx`, `apps/web/src/pages/vehicle-health/vehicle-health.tsx`, and `apps/web/src/components/layout/app-layout.tsx`
- [ ] T095 [US3] Move trip and OCR clients, query keys, invalidation rules, and stable write idempotency keys into `apps/web/src/features/trips/api.ts` and `apps/web/src/features/ocr/api.ts`; update imports in `apps/web/src/pages/trips/`, `apps/web/src/components/ocr/`, `apps/web/src/hooks/use-ocr-extract.ts`, and `apps/web/src/lib/ocr/`
- [ ] T096 [US3] Move expense/fuel/maintenance/goal/analytics/recommendation/score clients and query keys into `apps/web/src/features/expenses/api.ts`, `fuel/api.ts`, `maintenance/api.ts`, `goals/api.ts`, `analytics/api.ts`, `recommendations/api.ts`, and `score/api.ts`; update imports in `apps/web/src/pages/expenses/`, `maintenance/`, `planner/`, `analytics/`, `best-hours/`, `dashboard/`, `decisions/`, and `driver-score/`
- [ ] T097 [US3] Move community/review/support/notification/public-review clients and query keys into `apps/web/src/features/community/api.ts`, `reviews/api.ts`, `support/api.ts`, and `notifications/api.ts`; update imports in `apps/web/src/pages/community/`, `reviews/`, `support/`, `notifications/`, `apps/web/src/components/notifications/`, and `apps/web/src/components/testimonials/`
- [ ] T098 [US3] Replace generic status-only retry logic with the shared driver retry classifier, leave mutations at retry zero unless their operation supplies a stable idempotency key, and preserve persisted-query behavior in `apps/web/src/providers/query-provider.tsx`

### Admin Client Implementation for User Story 3

- [x] T099 [US3] Implement the admin realm Axios adapter, shared-envelope parser adapter, normalized realm outcomes, retry classifier, `Retry-After` parser, idempotency-key helper, and test exports in `apps/admin/src/features/platform-api/client.ts`, `parse.ts`, `errors.ts`, `retry.ts`, `idempotency.ts`, and `index.ts` until T081 passes
- [ ] T100 [US3] Move admin auth client and shared auth contracts into `apps/admin/src/features/auth/api.ts` and `apps/admin/src/features/auth/contracts.ts`; update `apps/admin/src/pages/login.tsx`, `apps/admin/src/stores/admin-auth.store.ts`, and auth refresh handling without mixing driver credentials
- [ ] T101 [US3] Move user/driver/trip/vehicle clients, table query keys, filters, and bulk idempotency into `apps/admin/src/features/users/api.ts`, `drivers/api.ts`, `trips/api.ts`, and `vehicles/api.ts`; update `apps/admin/src/pages/users.tsx`, `user-detail.tsx`, `drivers.tsx`, `driver-detail.tsx`, `trips.tsx`, `trip-detail.tsx`, and `vehicles.tsx`
- [ ] T102 [US3] Move community/review/support/notification clients, query keys, reason contracts, and mutation invalidation into `apps/admin/src/features/community/api.ts`, `reviews/api.ts`, `support/api.ts`, and `notifications/api.ts`; update `apps/admin/src/pages/community.tsx`, `reviews.tsx`, `support.tsx`, `support-detail.tsx`, and `notifications.tsx`
- [ ] T103 [US3] Move audit/roles/settings/analytics/health clients and query keys into `apps/admin/src/features/audit/api.ts`, `roles/api.ts`, `settings/api.ts`, `analytics/api.ts`, and `health/api.ts`; update `apps/admin/src/pages/audit.tsx`, `roles.tsx`, `settings.tsx`, `analytics.tsx`, `health.tsx`, `apps/admin/src/router.tsx`, and replace the inline QueryClient retry configuration in `apps/admin/src/main.tsx`
- [ ] T104 [US3] Remove obsolete transport definitions from `apps/web/src/lib/api/endpoints.ts`, `apps/web/src/lib/api/ocr.api.ts`, `apps/admin/src/lib/api/endpoints.ts`, `apps/admin/src/lib/contracts/admin-auth.ts`, and `apps/admin/src/lib/api-error.ts`; leave only temporary re-export shims if an unmigrated import is proven by `npm run contracts:inventory`, then remove every shim before completing this task
- [ ] T105 [US3] Make T080-T085 pass across `apps/api/src/modules/idempotency/`, `apps/web/src/features/platform-api/`, and `apps/admin/src/features/platform-api/`, then verify with `npm run api:test -- --runInBand`, `npm run web:test`, `npm run admin:test`, and `npm run test:integration`

**Checkpoint**: User Story 3 is complete when both clients reject malformed or incompatible data,
retry only documented transient safe reads, preserve realm-specific outcomes, and duplicate writes
produce one business effect.

---

## Phase 6: User Story 4 - Enforce Application and Package Boundaries (Priority: P2)

**Goal**: Invalid direct, aliased, dynamic, transitive, cyclic, private-subpath, undeclared, and
cross-artifact dependencies fail with the responsible dependency path.

**Independent Test**: Run `npm run verify:boundaries` and
`npm run verify:frontend-isolation`; every controlled violation must fail and every allowed shared
package import must pass.

### Tests for User Story 4

- [ ] T106 [P] [US4] Create passing and failing dependency fixtures for web-to-admin, admin-to-web, frontend-to-API, frontend-to-Prisma/NestJS/server config, shared-package framework imports, private subpaths, undeclared packages, direct cycles, transitive cycles, aliases, and dynamic imports under `scripts/verification/fixtures/boundaries/`
- [ ] T107 [P] [US4] Write failing rule-contract tests that assert every fixture's rule ID, non-zero result, dependency path, and remediation message in `scripts/verification/tests/boundary-rules.test.mjs`

### Implementation for User Story 4

- [x] T108 [US4] Implement reusable `no-restricted-imports` configurations and shared-package restrictions from `contracts/boundary-rules.md` in `packages/eslint-config/index.mjs`
- [x] T109 [US4] Consume `@ehsbha/eslint-config` from `eslint.config.mjs`, replacing duplicated boundary rules while preserving existing repository ignores and OCR fixture exceptions
- [x] T110 [US4] Implement dependency-cruiser rules for applications, shared packages, aliases, dynamic/transitive imports, cycles, private exports, and undeclared dependencies in `.dependency-cruiser.cjs`
- [x] T111 [US4] Implement the boundary command wrapper with bounded, path-rich diagnostics in `scripts/verification/verify-boundaries.mjs`
- [ ] T112 [US4] Add package public-export and side-effect tests for `shared-types`, `api-contracts`, `ui-tokens`, and `eslint-config` in `scripts/verification/tests/shared-package-boundaries.test.mjs`
- [x] T113 [US4] Implement production artifact isolation checks for forbidden driver/admin source markers and source-map module paths in `scripts/verification/verify-frontend-isolation.mjs` and `scripts/verification/tests/frontend-isolation.test.mjs`
- [x] T114 [US4] Wire `verify:boundaries` and `verify:frontend-isolation` into `package.json` and `scripts/verification/verify.mjs` after typecheck and after frontend builds respectively, with failures blocking evidence integrity
- [ ] T115 [US4] Run `npm run lint`, `npm run verify:boundaries`, `npm run build`, and `npm run verify:frontend-isolation`; fix only diagnostics originating from `packages/eslint-config/index.mjs`, `eslint.config.mjs`, `.dependency-cruiser.cjs`, `scripts/verification/verify-boundaries.mjs`, or `scripts/verification/verify-frontend-isolation.mjs`

**Checkpoint**: No forbidden dependency or cycle survives source and artifact checks, and every
allowed package import remains independently buildable.

---

## Phase 7: User Story 5 - Evolve Contracts Without Hidden Breakage (Priority: P3)

**Goal**: Contract identity, compatibility classification, generated documentation, migration
requirements, coordinated release order, and rollback evidence are mechanically visible.

**Independent Test**: Additive fixtures pass, incompatible fixtures fail without migration
metadata/version transition, generated catalog/OpenAPI stay fresh, and a coordinated release
rehearsal rejects mixed artifact revisions.

### Tests for User Story 5

- [ ] T116 [P] [US5] Write additive, behavior-change, incompatible-field, changed-unit, changed-error, changed-pagination, removed-operation, and unsupported-major fixtures plus expected results in `scripts/contracts/fixtures/compatibility/` and `scripts/verification/tests/contract-compatibility.test.mjs`
- [ ] T117 [P] [US5] Write failing generated-artifact freshness tests for catalog/OpenAPI determinism, API/contract version metadata, and operation coverage in `scripts/verification/tests/contract-artifacts.test.mjs`

### Implementation for User Story 5

- [x] T118 [US5] Implement catalog comparison and compatibility classification in `scripts/contracts/compare-catalogs.mjs`, requiring affected consumers, migration behavior, compatibility window, release order, and recovery metadata for incompatible changes until T116 passes
- [ ] T119 [US5] Add typed migration metadata and contract-version declarations to `packages/api-contracts/src/catalog/compatibility.ts` and `packages/api-contracts/src/catalog/registry.ts`, rejecting incompatible entries that remain in major version 1 without an approved transition
- [ ] T120 [US5] Add deterministic freshness verification for `verification-output/contracts/contract-catalog.json` and `verification-output/contracts/openapi.json` in `scripts/contracts/verify-contracts.mjs` until T117 passes
- [ ] T121 [US5] Update `.github/workflows/verify.yml` for pull requests to generate the base revision catalog in an isolated `base-contracts` checkout, generate the head catalog in the main checkout, and run `scripts/contracts/compare-catalogs.mjs` without caching generated outputs
- [x] T122 [US5] Document contract authoring, operation registration, compatibility classes, consumer migration, and the 10-minute lookup walkthrough in `docs/contracts/README.md` and `docs/contracts/migration-guide.md`
- [ ] T123 [US5] Record the coordinated initial cutover decision, rejected staged legacy-envelope alternative, consequences, owner, and rollback model in `docs/adr/0002-coordinated-shared-contract-cutover.md`
- [ ] T124 [US5] Implement coordinated artifact revision/version validation and mixed-revision rejection in `scripts/verification/verify-coordinated-release.mjs` and `scripts/verification/tests/coordinated-release.test.mjs`; document deploy/rollback steps in `docs/contracts/coordinated-release-runbook.md`
- [ ] T125 [US5] Run `npm run contracts:generate`, `npm run verify:contracts`, `scripts/verification/tests/contract-compatibility.test.mjs`, and `scripts/verification/tests/coordinated-release.test.mjs`; confirm additive `1.x` fixtures pass and incompatible fixtures cannot pass without explicit transition metadata

**Checkpoint**: Contract generation, compatibility checks, CI comparison, documentation, and
coordinated release/rollback evidence are complete.

---

## Phase 8: Polish and Cross-Cutting Verification

**Purpose**: Remove migration residue, measure budgets, update operational documentation, and run
the complete repository gate.

- [ ] T126 [P] Update shared package usage, contract generation, and verification documentation in `README.md`, `ARCHITECTURE.md`, `scripts/verification/README.md`, and `docs/contracts/README.md` without claiming unfinished Phase 2 identity work
- [x] T127 [P] Add generated contract/OpenAPI output paths and temporary base-checkout paths to `.gitignore`, and add a verification test preventing generated catalog/OpenAPI files from being committed in `scripts/verification/tests/generated-contract-artifacts.test.mjs`
- [ ] T128 Add contract validation latency and shared-package compressed-size measurements with the 10% regression rule in `scripts/verification/measure-contracts.mjs`, `scripts/verification/tests/measure-contracts.test.mjs`, and `scripts/verification/verify.mjs`
- [ ] T129 Enforce constitution coverage thresholds for changed shared contract, idempotency, API boundary, and client parsing/retry code in `vitest.config.ts`, `apps/api/package.json`, `apps/web/package.json`, `apps/admin/package.json`, and root `package.json`
- [ ] T130 Extend secret/personal-data scanning to generated contract evidence, idempotency replay fixtures, error details, and OpenAPI examples in `scripts/verification/lib/security-scan.mjs` and `scripts/verification/tests/sensitive-artifacts.test.mjs`
- [ ] T131 Verify existing Arabic/English, RTL/LTR, loading, empty, error, offline, forbidden, and session-expired behavior was not regressed by client migration; record evidence and any explicitly out-of-scope pre-existing gaps in `docs/contracts/client-behavior-audit.md`
- [ ] T132 Run the scripts defined in `package.json`, `apps/api/package.json`, `apps/web/package.json`, and `apps/admin/package.json`: `npm run lint`, `npm run packages:typecheck`, `npm run typecheck`, `npm run packages:test`, `npm run api:test -- --runInBand`, `npm run web:test`, `npm run admin:test`, `npm run test:contract`, and `npm run build`; fix only failures introduced by feature 002
- [ ] T133 Run clean Prisma generation, migration, seed, idempotency integration tests, API startup, liveness, readiness, and shutdown through `npm run test:integration`; record migration and rollback evidence in `docs/contracts/idempotency-migration-verification.md`
- [ ] T134 Execute every scenario in `specs/002-shared-platform-contracts/quickstart.md`, update commands only if repository script names changed, and record actual pass/fail evidence in `docs/contracts/quickstart-verification.md`
- [ ] T135 Run `npm run verify` from a clean worktree on the coordinated API/web/admin revision; confirm contract and boundary steps are blocking, all evidence is sanitized/current-run, artifact budgets pass, and record the accepted revision in `docs/contracts/phase-1-verification.md`

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 Setup**: Starts immediately; T001 must complete before source edits.
- **Phase 2 Foundational**: Depends on all Setup tasks; blocks every user story.
- **User Story 1**: Depends on Foundation; establishes shared domain contracts and catalog.
- **User Story 2**: Depends on User Story 1 core schemas and API adoption.
- **User Story 3**: Depends on User Stories 1 and 2 because clients consume final envelopes and
  governed codes.
- **User Story 4**: Depends on package structure from Foundation; implementation may begin after
  Foundation, but final acceptance must run after User Story 3 removes migration shims.
- **User Story 5**: Depends on the complete operation catalog from User Story 1 and final response
  metadata from User Story 2.
- **Polish**: Depends on all selected user stories.

### User Story Completion Order

```text
Setup -> Foundation -> US1 -> US2 -> US3
                    \-> US4 --------/
                    \-> US5 --------/
US1 + US2 + US3 + US4 + US5 -> Polish
```

### Within Each User Story

- Write the named tests first and confirm the intended failure.
- Implement shared schemas/types before API or client adapters.
- Complete API producer adoption before client migration.
- Complete domain clients before deleting compatibility re-exports.
- Run the phase checkpoint before starting the next dependent story.

## Parallel Opportunities

### Setup

- T002-T005 may run together.
- T007-T009 may run together after package shells exist.

### Foundation

- T012-T014 may run together.
- T016-T020 and T023 may run together after shared types compile.

### User Story 1

- T026-T033 may run together.
- T034-T042 may run in parallel by domain after their matching test task exists.
- T044-T052 may run in parallel by API domain after T043.
- T054 and T057 may run alongside sequential edits to the two large endpoint modules.

### User Story 2

- T061-T065 may run together.
- T073 and T074 may run together.
- T076-T079 may run in parallel after the shared filter/interceptor behavior is stable.

### User Story 3

- T080-T085 may run together.
- T091 and T092 may run together after the idempotency module exists.
- Driver domain migrations T094-T097 are disjoint and may run in parallel after T093.
- Admin domain migrations T100-T103 are disjoint and may run in parallel after T099.

### User Story 4

- T106 and T107 may run together.
- Source boundary and artifact isolation work may run in parallel after fixtures exist.

### User Story 5

- T116 and T117 may run together.
- Documentation tasks T122-T124 may run in parallel after compatibility behavior is implemented.

## Parallel Execution Examples

### User Story 1 Domain Batch

```text
Task T034: packages/api-contracts/src/domains/auth-profile.ts
Task T035: packages/api-contracts/src/domains/vehicle-app-area.ts
Task T036: packages/api-contracts/src/domains/trip-ocr.ts
Task T037: packages/api-contracts/src/domains/operations.ts
Task T038: packages/api-contracts/src/domains/analytics-intelligence.ts
Task T039: packages/api-contracts/src/domains/communications.ts
Task T040: packages/api-contracts/src/domains/admin-core.ts
Task T041: packages/api-contracts/src/domains/admin-operations.ts
```

### User Story 3 Client Batch

```text
Driver worker A: T094 auth/profile/vehicle/app/area
Driver worker B: T095 trips/OCR
Driver worker C: T096 operations/analytics
Driver worker D: T097 communications
Admin worker A: T100 auth
Admin worker B: T101 management
Admin worker C: T102 moderation/support
Admin worker D: T103 governance/analytics/health
```

Do not run two tasks in parallel when they both edit `apps/web/src/lib/api/endpoints.ts`,
`apps/admin/src/lib/api/endpoints.ts`, `apps/api/src/app.module.ts`, `package.json`, or
`package-lock.json`.

## Implementation Strategy

### MVP First

1. Complete Setup and Foundation.
2. Complete User Story 1 through T060.
3. Stop and run the User Story 1 checkpoint.
4. The MVP is acceptable only as a development increment; do not deploy it because the clarified
   release requires one coordinated API/web/admin cutover.

### Incremental Development

1. Build and verify shared packages.
2. Migrate authoritative contracts and catalog all active operations.
3. Standardize API envelopes and errors.
4. Migrate driver/admin client behavior and idempotency.
5. Turn on boundary and compatibility enforcement.
6. Run coordinated release and rollback verification.

### Commit Strategy

- Commit after each task or one tightly related test/implementation pair.
- Keep domain migrations separate so failures identify one contract family.
- Never commit a failing phase checkpoint.
- Generated files under `verification-output/` remain uncommitted.

## Notes

- Total migration scope is 161 discovered API routes across 40 controllers, approximately 83
  driver calls, and 68 admin calls.
- Scaffold-only revenue, OCR oversight, and similar inactive operations remain cataloged with
  lifecycle, owner, and follow-up; do not implement their missing product behavior.
- Full browser E2E is not added because this phase changes transport contracts rather than product
  journeys. Existing route/build audits plus focused client tests and HTTP integration tests cover
  the applicable risk.
- Auth hardening, cookie migration, real admin TOTP, offline synchronization, billing, and advanced
  observability remain later-phase work.
