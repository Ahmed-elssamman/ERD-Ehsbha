# Implementation Plan: Complete Ehsbha Platform

**Spec-kit artifact:** `plan.md`  
**Baseline branch:** `main`  
**Repository snapshot reviewed:** 2026-06-07  
**Scope:** complete platform plan covering `apps/api`, `apps/web`, `apps/admin`, shared packages, database, testing, security, deployment, and operations.

## 1. Purpose

This plan is the execution source of truth for the entire Ehsbha repository.

It covers:

- The driver-facing PWA in `apps/web`.
- The administration application in `apps/admin`.
- The NestJS backend and Prisma data layer in `apps/api`.
- Shared contracts and architecture boundaries in `packages/*`.
- Existing features, incomplete features, planned features, security, tests, observability, deployment, and future billing.

The plan is based on the current code, not only the older architecture documents. The monorepo and much of the admin platform already exist, so completed work must be stabilized and extended instead of rebuilt.

## 2. Product Surfaces

### 2.1 Driver Web Application

The driver application includes:

- Registration, login, logout, refresh, forgot password, and reset password.
- Driver and user profile settings.
- Vehicle management and vehicle operating costs.
- Rideshare app sources, custom apps, and commissions.
- Areas and common operating locations.
- Manual trip CRUD.
- OCR-assisted single-trip and multi-trip capture.
- Batch trip creation and deletion.
- Expenses, fuel, maintenance, odometer, and work sessions.
- Dashboard KPIs and recent activity.
- Daily, weekly, monthly, app, area, and hour analytics.
- Monthly forecast.
- Smart decisions and recommendations.
- Driver score and score history.
- Best hours.
- Work planner and goals.
- Profit simulator.
- Vehicle health.
- Notifications and daily digest.
- Community posts and reactions.
- Platform reviews.
- Support tickets.
- Arabic and English.
- RTL and LTR layouts.
- Light, dark, and system themes.
- PWA installation, caching, offline fallback, and synchronization.

### 2.2 Admin Application

The admin application includes or plans:

- Separate admin authentication and MFA.
- Dashboard and operational queues.
- User, driver, trip, and vehicle management.
- OCR oversight and telemetry.
- Community moderation and reports.
- Platform review moderation.
- Support center and ticket lifecycle.
- Admin alerts and outbound notification campaigns.
- Audit logs.
- Admin users, roles, and permissions.
- Platform analytics and feature usage.
- Platform health.
- App source and maintenance catalogue settings.
- Revenue and subscriptions after billing exists.

### 2.3 API and Platform Services

The API includes:

- Driver and admin authentication realms.
- Prisma persistence and migrations.
- Domain modules for all driver features.
- Admin controller and service families.
- OCR processing and platform-specific parsers.
- Analytics, score, recommendation, maintenance, fuel, and vehicle-cost engines.
- Scheduled aggregates and daily digest generation.
- Mail delivery.
- Health and readiness endpoints.
- Synchronization endpoints.
- Global validation, response transformation, and exception mapping.

## 3. Current Repository Assessment

### 3.1 Implemented Foundations

- npm workspaces for `apps/*` and `packages/*`.
- Independent `api`, `web`, and `admin` applications.
- Separate driver and admin routers, layouts, stores, and build outputs.
- Prisma schema for the driver domain and the first admin domain.
- Separate admin JWT secret, strategy, refresh tokens, RBAC, and audit records.
- Driver pages for the major product features.
- Admin pages for most current management modules.
- Type checking currently passes across all three applications.

### 3.2 Critical Gaps

- The API test baseline has 10 failing OCR assertions across 3 suites.
- There are no dedicated admin test files.
- Admin MFA currently accepts any six-digit code.
- Admin credentials are stored in `localStorage`.
- The shared contract package is empty and frontend response types are duplicated.
- Cross-application import restrictions are documented but not mechanically enforced.
- Some architecture documents describe an old pre-monorepo state.
- CI/CD, security, migration, and E2E gates are not present in the repository.
- OCR telemetry, support messages, community reports, notification campaigns, feature events, job heartbeats, and billing models are not yet complete.

## 4. Technical Context

**Language:** TypeScript 5.7  
**Runtime:** Node.js, browser PWA  
**Backend:** NestJS 11  
**Database:** PostgreSQL with Prisma 6  
**Driver frontend:** React 19, Vite 6, React Router 7, TanStack Query, Zustand, Tailwind CSS  
**Admin frontend:** React 19, Vite 6, React Router 7, TanStack Query, Zustand, Tailwind CSS  
**Validation:** Zod  
**Authentication:** separate driver and admin JWT realms  
**OCR:** Azure Vision/Image Analysis pipeline with Sharp preprocessing and platform parsers  
**Testing:** Jest currently; Playwright and database integration testing to be added  
**Package management:** npm workspaces  
**Primary performance target:** mobile-first driver PWA and data-dense desktop admin  
**Localization:** Arabic and English with RTL/LTR  
**Deployment units:** API, driver web, and admin web are independent artifacts

### 4.1 Project Structure

```text
apps/
  api/
    prisma/                 Database schema, migrations, and seeds
    src/common/             Cross-cutting filters, pipes, decorators, and utilities
    src/modules/            Driver, OCR, analytics, community, support, and admin modules
    scripts/                Smoke tests, OCR benchmark, and operational scripts
    test-fixtures/          OCR images, golden values, and benchmark reports
  web/
    public/                 PWA, robots, sitemap, icons, and offline assets
    src/components/         Driver UI, layout, OCR, PWA, and shared-in-app primitives
    src/hooks/              Driver feature hooks
    src/lib/                API clients, formatting, OCR mapping, and utilities
    src/pages/              Driver routes and feature pages
    src/providers/          Query and theme providers
    src/stores/             Driver auth and client state
  admin/
    public/                 Admin static assets
    src/components/         Admin layout, controls, auth, tables, and UI primitives
    src/lib/                Admin API client, contracts, and utilities
    src/pages/              Admin operational pages
    src/routes/             Admin auth and permission route guards
    src/stores/             Admin auth and client state
packages/
  api-contracts/            Shared Zod API contracts
  shared-types/             Domain-neutral primitives and enums
  eslint-config/            Architecture and lint rules
  ui-tokens/                Optional shared visual tokens, not React pages
```

### 4.2 Spec-kit Artifact Expectations

- `spec.md` defines user stories, requirements, and acceptance criteria for a selected phase or feature slice.
- `plan.md` defines architecture, dependencies, sequencing, and implementation boundaries.
- `tasks.md` decomposes an approved phase into executable tasks grouped by API, web, admin, data, and tests.
- Research decisions that affect architecture must be recorded before task generation.
- A phase may be split into multiple specs, but each spec must retain end-to-end API/web/admin ownership.

## 5. Binding Architecture Rules

1. `apps/web` and `apps/admin` remain separate applications and deployments.
2. Neither frontend imports source files from the other frontend.
3. Shared contracts and domain-neutral primitives live under `packages/*`.
4. React pages, layouts, auth stores, and navigation remain application-specific.
5. Request and response validation use shared Zod contracts.
6. Driver and admin authentication realms use different secrets, claims, refresh stores, and guards.
7. The API is authoritative for authorization, invariants, calculations, and persisted state.
8. The frontend may calculate previews, but server results remain authoritative.
9. All privileged admin mutations require permission checks and audit records.
10. All driver-owned writes enforce ownership and idempotency where retries are possible.
11. Money is stored and transported as integer minor units.
12. Distances are stored in meters and durations in seconds.
13. API timestamps use ISO-8601 UTC.
14. Database changes require migrations, indexes, test data, and rollback notes.
15. A phase cannot finish with failing typecheck, tests, migrations, or production builds.

## 6. Standard Implementation Order

Every feature slice follows this dependency order:

1. Product rules and acceptance criteria.
2. Database models, constraints, indexes, and migration.
3. Shared request, response, error, and event contracts.
4. Pure domain logic and state transitions.
5. API services and transactions.
6. Controllers, guards, validation, rate limits, and audit binding.
7. Web API client, query keys, mutations, and cache invalidation.
8. Admin API client, permissions, queries, and cache invalidation.
9. Web and admin presentation.
10. Unit, integration, contract, E2E, security, and performance tests.
11. Metrics, logs, alerts, documentation, migration, and deployment.

## 7. Phase Dependency Graph

```text
Phase 0  Baseline and governance
  -> Phase 1  Shared platform foundation and contracts
      -> Phase 2  Identity, profiles, settings, and access security
          -> Phase 3  Trips and OCR capture
              -> Phase 4  Vehicle and operating-cost domain
                  -> Phase 5  Analytics, goals, recommendations, and score
                      -> Phase 6  Community, reviews, support, and notifications
                          -> Phase 7  Complete admin operations
                              -> Phase 8  Offline, PWA, quality, and observability
                                  -> Phase 9  Revenue and commercial platform
                                      -> Phase 10 Production release and operations
```

Phase 4 and Phase 6 may partially run in parallel after Phase 3. Phase 7 depends on stable domain APIs from Phases 2 through 6. Phase 9 is optional until a commercial model is approved.

# 8. Detailed Phases

## Phase 0 - Baseline, Governance, and Repository Truth

**Priority:** P0  
**Depends on:** none  
**Goal:** establish a green, reproducible, documented baseline before feature expansion.

### 0.1 Repository and Documentation

- Update `README.md` paths from the old `backend/` and `web/` layout to `apps/api` and `apps/web`.
- Update `ARCHITECTURE.md` from the old mobile-oriented assumptions to the current React PWA.
- Mark implemented sections in `ADMIN_ARCHITECTURE.md`.
- Replace stale pre-implementation statements in `ADMIN_SEPARATION_VERIFICATION.md`.
- Add an architecture decision record directory for irreversible decisions.
- Add a spec-kit constitution describing architecture, security, testing, and quality gates.
- Document supported Node, npm, PostgreSQL, browser, and operating-system versions.

### 0.2 API

- Fix all current OCR test regressions.
- Confirm whether failing OCR expectations or parser behavior represent the correct financial semantics.
- Add scripts for unit, integration, contract, smoke, and coverage test groups.
- Add a deterministic test environment configuration.
- Verify Prisma generation, clean migration, seed, build, start, health, and readiness.
- Remove dead modules, unused dependencies, and stale script paths only after proving they are unused.

### 0.3 Web

- Verify every route builds and loads through lazy import.
- Verify the API base URL and production environment handling.
- Audit console errors, query failures, missing translations, and broken empty states.
- Verify service worker registration and generated PWA assets are not incorrectly committed.
- Establish bundle-size and route-chunk baselines.

### 0.4 Admin

- Verify every route builds and loads for a Super Admin.
- Verify each current page points to an existing API endpoint.
- Remove or clearly label obsolete stubs.
- Establish current permission-to-route coverage.
- Record pages that show scaffold data rather than complete domain data.

### 0.5 Tooling and CI

- Add root scripts: `lint`, `test`, `test:integration`, `test:e2e`, `build`, and `verify`.
- Add shared formatting and editor configuration.
- Add CI stages:
  - Install with lockfile.
  - Prisma generate.
  - Lint.
  - Typecheck.
  - Unit tests.
  - Integration tests.
  - Clean migration test.
  - API, web, and admin production builds.
- Cache dependencies without caching generated application outputs.
- Upload test and coverage reports on failure.

### 0.6 Exit Criteria

- All existing tests pass.
- API, web, and admin production builds pass.
- Clean database migration and seed pass in CI.
- Documentation matches the current repository structure.
- `npm run verify` is the single local and CI verification entry point.

## Phase 1 - Shared Platform Foundation and API Contracts

**Priority:** P0  
**Depends on:** Phase 0  
**Goal:** make all applications consume stable contracts and follow enforceable boundaries.

### 1.1 Shared Packages

- Build `packages/api-contracts`.
- Add shared schemas for:
  - Success and error envelopes.
  - Cursor and offset pagination.
  - Authentication.
  - User and driver profiles.
  - Vehicles, app sources, areas, and trips.
  - OCR requests, parsed results, warnings, and confidence.
  - Expenses, fuel, maintenance, odometer, sessions, and goals.
  - Analytics, recommendations, score, and forecast.
  - Community, reviews, support, and notifications.
  - Admin auth, users, drivers, trips, vehicles, moderation, support, audit, roles, settings, health, and analytics.
- Build `packages/shared-types` for branded minor-unit money, meters, seconds, IDs, locale, timezone, and common enums.
- Build `packages/eslint-config` with cross-app import restrictions.
- Add `packages/ui-tokens` only for colors, typography, spacing, motion, and Tailwind preset. Do not share application pages or layouts.

### 1.2 API

- Move pure Zod DTOs into or re-export them from the contract package without importing NestJS or Prisma code into frontend bundles.
- Standardize all endpoint responses.
- Standardize all error codes and HTTP mappings.
- Standardize pagination and maximum page sizes.
- Add request IDs to every response and log entry.
- Add API version and contract version metadata.
- Generate OpenAPI from the authoritative contracts or keep a tested manual mapping.
- Add contract parsing tests for representative success and failure responses.

### 1.3 Web

- Replace locally duplicated endpoint interfaces with imported contract types.
- Add one typed API helper for envelope unwrapping and error normalization.
- Define centralized query-key factories.
- Define mutation invalidation rules by domain.
- Add consistent retry rules:
  - No automatic retry for validation or authorization.
  - Limited retry for safe reads.
  - Idempotency keys for retryable writes.
- Add global route error, query error, and offline states.

### 1.4 Admin

- Replace untyped `r.data` use with parsed shared response contracts.
- Define admin query-key factories by module.
- Add consistent forbidden, stale-permission, MFA-required, and session-expired handling.
- Add a reusable table query contract for search, sort, filters, cursor, and export.
- Add reusable admin mutation reason and reason-code contracts.

### 1.5 Architecture Enforcement

- CI must fail when `apps/web` imports `apps/admin` or the reverse.
- CI must fail when a frontend imports Prisma, NestJS, server secrets, or backend-only modules.
- Add dependency graph checks for package cycles.
- Add bundle inspection proving one frontend is absent from the other frontend bundle.

### 1.6 Exit Criteria

- All active API clients consume shared contracts.
- Contract drift causes compile-time or contract-test failures.
- Cross-app imports are mechanically blocked.
- Errors, dates, pagination, and money use one platform-wide format.

## Phase 2 - Identity, Profiles, Settings, and Access Security

**Priority:** P0  
**Depends on:** Phase 1  
**Goal:** complete secure driver and admin identity lifecycles.

### 2.1 Data Layer

- Review `User`, `Driver`, `RefreshToken`, `PasswordResetToken`, `DeviceToken`, and admin identity models.
- Add refresh-token family/session metadata if missing.
- Add login-attempt and temporary-lockout fields or a dedicated security-event model.
- Add admin MFA recovery-code storage using hashes.
- Add admin session records if operators need session visibility and remote revocation.
- Add privacy-safe security events for login, password reset, refresh reuse, MFA changes, and suspicious access.
- Add indexes for active sessions, token expiry, email, phone, and security-event lookup.

### 2.2 API - Driver Authentication

- Validate and normalize Egyptian phone numbers consistently.
- Complete register, login, refresh rotation, logout, password lookup, forgot password, and reset password.
- Enforce refresh reuse detection and revoke the full token family.
- Rate-limit login, password lookup, forgot password, reset password, and refresh.
- Prevent account enumeration through response timing and wording.
- Add password strength and breached-password policy if required.
- Revoke sessions when an account is suspended, password is reset, or credentials are compromised.
- Add optional email/phone verification only when a delivery provider is selected.

### 2.3 API - Driver Profile and Settings

- Complete `/me` and `/drivers/me`.
- Validate locale, timezone, display name, city, work preferences, and notification preferences.
- Define profile completeness and onboarding status.
- Support safe account anonymization and export.
- Separate user identity fields from driver business-profile fields.

### 2.4 API - Admin Authentication and RBAC

- Replace fake MFA verification with real TOTP.
- Add MFA enrollment, QR provisioning, confirmation, recovery codes, reset, and disable policy.
- Require MFA for Super Admin and Admin roles.
- Move refresh credentials to Secure, HttpOnly, SameSite cookies.
- Keep short-lived access tokens in memory where practical.
- Add CSRF protection for cookie-authenticated mutations.
- Validate secret, issuer, audience, payload shape, admin status, permission version, and MFA state.
- Add login throttling, lockout, refresh reuse detection, and suspicious-login alerts.
- Increment `permissionsVersion` transactionally when roles or permissions change.
- Prevent self-deletion and deletion or deactivation of the final Super Admin.

### 2.5 Web

- Complete registration, login, logout, refresh, forgot password, and reset password UX.
- Preserve intended route across login.
- Provide clear expired-session and revoked-session messaging.
- Complete onboarding for profile, vehicle, app source, area, and first trip.
- Complete Settings sections:
  - Personal profile.
  - Driver profile.
  - Locale and timezone.
  - Theme.
  - Notification preferences.
  - Vehicles.
  - App sources and commission.
  - Areas.
  - Account export and deletion request.
- Validate forms with shared schemas.
- Ensure Arabic and English messages cover every auth error.

### 2.6 Admin

- Complete login, MFA challenge, logout, refresh, and session-expiry UX.
- Add MFA enrollment and recovery-code screens.
- Add a profile/security screen with active sessions and session revocation.
- Gate routes and controls by permission.
- Display environment, role, build version, and session-security state.
- Add admin account creation, activation, deactivation, role assignment, and forced MFA reset.

### 2.7 Tests

- Driver auth integration tests for all success and failure paths.
- Cross-realm token confusion tests.
- Refresh rotation and replay tests.
- Password reset expiry, reuse, and account enumeration tests.
- Admin TOTP valid, invalid, expired-window, replay, and recovery-code tests.
- Generated permission matrix tests for all five system roles.
- Web and admin E2E login flows.

### 2.8 Exit Criteria

- Driver and admin identity lifecycles are production-safe.
- Driver tokens cannot access admin endpoints and the reverse.
- MFA validates real secrets and recovery codes.
- Account or permission changes invalidate affected sessions.
- Auth and profile workflows pass E2E in Arabic and English.

## Phase 3 - Trips and OCR Capture

**Priority:** P0  
**Depends on:** Phase 2  
**Goal:** make trip capture accurate, retry-safe, observable, and complete across manual and OCR flows.

### 3.1 Data Layer

- Review trip financial fields and define authoritative meanings:
  - Gross fare.
  - Driver received amount.
  - Commission.
  - Tips, bonuses, tolls, waiting fees, and adjustments.
- Enforce non-negative and cross-field invariants where valid.
- Preserve soft deletion and restoration metadata.
- Add source metadata: manual, OCR, import, admin edit.
- Persist OCR extraction logs without storing prohibited image content.
- Add OCR request ID, image hash, provider, detected platform, latency, confidence, warnings, and parser version.
- Define optional image retention separately with encryption, access control, and deletion policy.
- Add indexes for driver/date, app/date, area/date, deletion state, and OCR lookup.

### 3.2 API - Manual Trips

- Complete list, detail, create, update, delete, batch create, and batch delete.
- Enforce ownership on every operation.
- Enforce `clientMutationId` idempotency.
- Make aggregate updates transactional with trip writes.
- Define duplicate-trip detection without rejecting legitimate repeated trips.
- Validate dates, distances, duration, amounts, app source, area, vehicle, and payment method.
- Add restore support if driver-facing recovery is approved.
- Add export support for driver data.

### 3.3 API - OCR Pipeline

- Stabilize image preprocessing.
- Stabilize Arabic and English digit and semantic normalization.
- Maintain platform detection for Uber, inDrive, DiDi, and Careem.
- Maintain platform-specific parsers.
- Complete multi-screenshot merge and multi-trip splitting.
- Define field precedence and confidence-weight rules.
- Validate parsed results against business invariants.
- Return machine-readable warnings and per-field confidence.
- Add provider timeout, retry, circuit-breaker, and payload-size policy.
- Add parser-version metadata so historical regressions can be reproduced.
- Add benchmark gates for every supported platform and screenshot type.

### 3.4 Web

- Complete trip list:
  - Date presets.
  - Infinite scrolling.
  - Search and filters.
  - Bulk selection and delete.
  - Retry only failed batch items.
  - Empty, loading, error, and offline states.
- Complete trip form:
  - Manual entry.
  - Edit.
  - Validation.
  - Vehicle, app, and area selectors.
  - Financial totals and derived values.
- Complete OCR flow:
  - Platform selection.
  - Single or multiple trip mode.
  - One to five screenshots.
  - Upload progress and cancellation.
  - Extracted summary.
  - Multi-trip review.
  - Per-field confidence.
  - Warning explanations.
  - Manual correction.
  - Batch save with stable mutation IDs.
- Preserve unsaved review state across accidental navigation or refresh where feasible.
- Add accessibility for file drop, keyboard editing, and confidence indicators.

### 3.5 Admin

- Complete trip search, detail, soft delete, restore, edit, and export.
- Show before/after audit history.
- Show source, OCR request, confidence, warnings, and parser version.
- Build OCR overview:
  - Requests.
  - Success and failure rates.
  - Latency.
  - Provider health.
  - Platform detection accuracy.
  - Low-confidence fields.
  - Parser-version regressions.
- Add OCR log detail with privacy-safe raw metadata.
- Add replay only after image-retention policy is approved.
- Add controlled threshold settings with validation and audit.

### 3.6 Tests

- Unit tests for every parser, normalizer, merger, detector, scorer, and validator.
- Golden fixture tests for every supported platform.
- Regression benchmark thresholds by field and platform.
- Integration tests for OCR-to-batch-save.
- Transaction and aggregate consistency tests.
- Idempotency and duplicate retry tests.
- Web E2E for manual trip and OCR multi-trip flows.
- Admin E2E for trip inspection and restoration.

### 3.7 Exit Criteria

- OCR test and benchmark baselines are green.
- Manual and OCR trip creation produce the same canonical trip model.
- Batch retries cannot create duplicates.
- Aggregate data remains consistent after create, edit, delete, and restore.
- Admin operators can diagnose OCR failures without direct database access.

## Phase 4 - Vehicles, Apps, Areas, Sessions, Fuel, Expenses, Maintenance, and Odometer

**Priority:** P1  
**Depends on:** Phase 3  
**Goal:** complete the operating-cost and vehicle-health foundation used by analytics and recommendations.

### 4.1 Data Layer

- Review `Vehicle`, `AppSource`, `DriverApp`, `Area`, `Session`, `FuelLog`, `Expense`, `MaintenanceItem`, `MaintenanceRecord`, and `DailyOdometer`.
- Define one active vehicle policy or support multi-vehicle trip attribution explicitly.
- Store vehicle fixed and variable costs in minor units.
- Add recurring-expense metadata if recurring expenses are in scope.
- Add full-tank and odometer semantics for fuel efficiency.
- Add maintenance interval overrides per vehicle.
- Add data-quality and completeness indicators.
- Add indexes by driver, vehicle, date, category, and active state.

### 4.2 API - Vehicles

- Complete vehicle CRUD.
- Complete cost updates and cost summary.
- Prevent deleting vehicles referenced by history; use deactivate or archive.
- Validate make, model, year, type, fuel type, odometer, acquisition, rental, insurance, depreciation, and maintenance cost fields.
- Recalculate affected analytics after cost changes.

### 4.3 API - App Sources and Areas

- Maintain a system app catalogue.
- Let drivers enable apps, set custom names, and set commission.
- Prevent deletion of app sources used by trips; archive instead.
- Complete area CRUD and driver ownership.
- Normalize area names while preserving user display names.

### 4.4 API - Work Sessions

- Complete session list, current/open session, start, and end.
- Prevent overlapping open sessions unless explicitly allowed.
- Associate session with app, vehicle, area, and opening/closing odometer.
- Calculate duration and session profitability.
- Recover stale open sessions safely.

### 4.5 API - Fuel and Odometer

- Complete fuel CRUD, not only create/list.
- Validate liters, price, total, odometer, station, and full-tank state.
- Calculate rolling L/100km only from valid intervals.
- Complete daily odometer reads and monotonicity checks.
- Handle odometer corrections with audit history rather than silent overwrite.

### 4.6 API - Expenses

- Complete categorized expense CRUD.
- Add optional vehicle and trip attribution.
- Add recurring expense templates if approved.
- Define tax/VAT fields as out of scope until the commercial phase.
- Ensure expense edits invalidate relevant aggregates.

### 4.7 API - Maintenance

- Complete maintenance item catalogue and localization.
- Complete service records, history, next-due calculations, and risk endpoint.
- Support time-based and distance-based intervals.
- Support per-vehicle custom intervals.
- Define GREEN, AMBER, RED, and OVERDUE rules.
- Generate notifications when risk changes materially.

### 4.8 Web

- Complete Settings vehicle, app, area, and cost management.
- Add work session start/end surface if not currently exposed.
- Complete expense page with monthly total, category chart, CRUD, and filters.
- Add a dedicated fuel logging surface or integrate it clearly into vehicle health.
- Complete maintenance page:
  - Risk summary.
  - Catalogue.
  - Service form.
  - Next-due preview.
  - Component history.
- Complete vehicle-health page:
  - True cost per kilometer.
  - Data completeness.
  - Component risk.
  - Fuel efficiency.
  - Predictive alerts.
- Show data-quality warnings when calculations lack enough history.

### 4.9 Admin

- Complete vehicle list/detail/edit/archive.
- Add App Source catalogue management.
- Add Maintenance Item catalogue management with Arabic and English labels.
- Add area and app usage summaries.
- Add suspicious cost/fuel/odometer anomaly views.
- Allow support/admin correction only with reason, before/after audit, and recalculation.

### 4.10 Tests

- Vehicle ownership and archive tests.
- Session overlap and stale-session tests.
- Fuel interval and efficiency tests.
- Expense category and aggregate invalidation tests.
- Maintenance risk and due-date tests.
- Odometer correction tests.
- Web E2E for vehicle setup, expense, fuel, and maintenance.
- Admin E2E for catalogue and correction workflows.

### 4.11 Exit Criteria

- Vehicle costs and operating records are complete enough to drive trusted profitability.
- Fuel and maintenance calculations expose data quality.
- Historical records cannot be destroyed through unsafe deletes.
- Web and admin workflows cover all correction and catalogue operations.

## Phase 5 - Dashboard, Analytics, Forecast, Goals, Planner, Recommendations, and Driver Score

**Priority:** P1  
**Depends on:** Phase 4  
**Goal:** turn canonical operating data into useful, explainable driver intelligence.

### 5.1 Data and Aggregate Layer

- Review daily, weekly, monthly, app, and area aggregates.
- Define source-of-truth formulas for gross, received, commission, expenses, fuel, maintenance allocation, net, hours, paid kilometers, empty kilometers, and profit per hour.
- Add aggregate versioning or rebuild metadata.
- Add nightly and on-write update strategy.
- Add safe rebuild jobs by driver and date range.
- Add freshness timestamps and data-quality status.
- Add feature events for later product analytics.

### 5.2 API - Dashboard and Analytics

- Complete today, daily, weekly, monthly, app, area, and hour endpoints.
- Define timezone boundaries using driver timezone.
- Add comparison periods and trend deltas.
- Return chart-ready bounded datasets.
- Add monthly forecast with explainable inputs and confidence.
- Add query caching only after correctness and invalidation are proven.

### 5.3 API - Goals and Work Planner

- Complete goal CRUD and progress.
- Enforce one active goal per period/type where appropriate.
- Calculate earned, remaining, days remaining, required daily net, required hours, and required trips.
- Compare required pace against historical percentiles.
- Handle timezone and month-boundary edge cases.

### 5.4 API - Recommendations and Smart Decisions

- Version recommendation rules.
- Define required input data and fallback behavior.
- Rank by urgency, expected EGP impact, confidence, and actionability.
- Record generation time, rule code, explanation, and expiry.
- Support daily dismissal and avoid repeating stale recommendations.
- Measure recommendation follow-through only from explicit or reliable events.

### 5.5 API - Driver Score

- Define productivity, discipline, health, and smart-choice formulas.
- Make every sub-score explainable.
- Define minimum-data behavior.
- Persist snapshots after meaningful data changes or scheduled calculation.
- Add score recalculation jobs and admin-triggered rebuild.
- Prevent peer benchmarking until privacy and cohort-size rules are approved.

### 5.6 Web

- Complete dashboard:
  - Today KPIs.
  - Forecast.
  - Top decisions.
  - Score.
  - Recent trips.
  - Clear freshness and incomplete-data states.
- Complete analytics six-tab experience.
- Complete Best Hours with 7, 30, and 90-day windows.
- Complete Work Planner with realistic-pace warning.
- Complete goals creation and progress editing.
- Complete Smart Decisions list and dismissal.
- Complete Driver Score ring, sub-scores, explanation, and history.
- Complete Profit Simulator:
  - Manual assumptions.
  - Real vehicle-cost toggle.
  - Daily, weekly, and monthly result.
  - No persistence unless scenarios are later added.
- Respect locale, timezone, reduced motion, and responsive chart constraints.

### 5.7 Admin

- Complete platform dashboard with operational KPIs and queues.
- Complete analytics overview:
  - Users and drivers.
  - Trips and gross activity.
  - OCR quality.
  - Platform/app mix.
  - Geography.
  - Retention and onboarding only after events exist.
- Add driver analytics detail and score history.
- Add aggregate rebuild/recalculate actions with strict permission and job tracking.
- Add metric definitions and freshness indicators to every chart.
- Add CSV export through background jobs for large datasets.

### 5.8 Tests

- Unit tests for every formula and boundary.
- Snapshot/contract tests for chart payloads.
- Timezone, daylight-saving, ISO week, leap year, and month-boundary tests.
- Aggregate rebuild equivalence tests.
- Recommendation ranking and dismissal tests.
- Score minimum-data and recalculation tests.
- Web chart accessibility and reduced-motion tests.
- Load tests for dashboard and analytics endpoints.

### 5.9 Exit Criteria

- Every metric has one documented definition.
- Dashboard and analytics agree for the same period.
- Forecasts, recommendations, and scores explain their inputs.
- Aggregate rebuilds reproduce on-write results.
- Drivers can act on insights without interpreting raw accounting data.

## Phase 6 - Community, Reviews, Support, Notifications, and Mail

**Priority:** P1  
**Depends on:** Phase 2; may overlap late Phase 4  
**Goal:** complete trust, communication, moderation, and support workflows.

### 6.1 Data Layer

- Add `CommunityReport`.
- Add moderation status and soft-delete metadata where missing.
- Add `SupportMessage`, assignment, priority, SLA, and linked-entity fields.
- Add `NotificationCampaign` and delivery records.
- Add notification preferences and channel status.
- Add admin alert acknowledgement/read state in normalized form if JSON arrays become limiting.
- Add indexes for queues, status, assignment, recipient, created date, and unresolved alerts.

### 6.2 API - Community

- Complete categories, paginated posts, create, react, and author delete.
- Enforce content length, category, rate limit, and ownership.
- Add report creation and duplicate-report prevention.
- Add moderation status without exposing private reporter data.
- Define reaction idempotency.
- Generate moderation notifications where appropriate.

### 6.3 API - Platform Reviews

- Complete public featured and summary endpoints.
- Complete authenticated list, own review, upsert, and delete.
- Clarify that platform reviews are reviews of Ehsbha, not passenger ratings.
- Validate rating, title, body, locale, and approval state.
- Prevent moderation fields from driver writes.

### 6.4 API - Support

- Complete driver ticket list, detail, create, reply, and close/reopen rules.
- Add message thread with driver, admin, and internal-note message types.
- Add assignment, priority, category, status transitions, and SLA timestamps.
- Send email and in-app updates without making ticket creation depend on mail success.
- Store mail delivery status and retry failures.

### 6.5 API - Notifications

- Complete inbox pagination and mark-read.
- Add bulk mark-read.
- Complete device registration and replacement.
- Complete daily digest generation and deduplication.
- Add notification preference enforcement.
- Add per-user admin notifications.
- Add targeted and broadcast campaigns with preview, dry run, schedule, cancel, delivery, and failure reporting.
- Require bilingual content or an audited single-language override.

### 6.6 Web

- Complete Community:
  - Feed.
  - Composer.
  - Reactions.
  - Delete own post.
  - Report.
  - Moderation status messaging.
- Complete Platform Reviews:
  - Summary.
  - Community reviews.
  - Create/edit own review.
  - Delete own review.
- Complete Support:
  - Ticket creation.
  - Ticket list.
  - Threaded detail.
  - Driver reply.
  - Close and reopen where allowed.
  - Attachment support only after storage policy exists.
- Complete Notifications:
  - Inbox.
  - Mark read.
  - Bulk mark read.
  - Daily digest.
  - Deep links.
  - Preference controls.
- Add safe rendering for all user-generated text.

### 6.7 Admin

- Complete Community moderation queue, reports, post detail, hide, unhide, feature, delete, restore, and emergency remove.
- Complete Review approval, feature, unfeature, delete, and restore.
- Complete Support queues by status, priority, assignment, category, and SLA.
- Complete support detail with public replies and internal notes.
- Complete Notification Center:
  - Admin alerts.
  - Per-user compose.
  - Campaign builder.
  - Cohort filters.
  - Preview and dry run.
  - Schedule and cancel.
  - Delivery metrics.
- Add audit drill-down to every moderation and support detail page.

### 6.8 Tests

- Community ownership, rate-limit, reporting, and moderation tests.
- Review public/private field tests.
- Support transition matrix and SLA tests.
- Mail failure and retry tests.
- Notification preference, deduplication, and campaign cohort tests.
- XSS and unsafe-link tests for user-generated content.
- Web E2E for post, review, ticket, and inbox.
- Admin E2E for moderation, support, and campaign lifecycle.

### 6.9 Exit Criteria

- Drivers and operators can complete the full support conversation in-app.
- Moderation actions are reversible and audited.
- Notification delivery respects preferences and records failures.
- User-generated content is safely rendered and rate-limited.

## Phase 7 - Complete Admin Operations and Governance

**Priority:** P1  
**Depends on:** Phases 2 through 6  
**Goal:** make the admin application a complete operational control plane.

### 7.1 Admin Dashboard

- Add role-specific dashboard views.
- Add KPI cards with comparison periods and freshness.
- Add queues for moderation, support, OCR failures, suspended users, unresolved alerts, and failed campaigns.
- Add recent audited activity.
- Add links from every queue to the filtered working view.

### 7.2 User and Driver Management

- Complete search, sorting, filters, saved views, cursor pagination, and export.
- Add detail tabs for profile, vehicles, apps, trips, expenses, maintenance, score, notifications, support, and audit.
- Complete suspend, activate, blacklist, restore, anonymize, export package, and merge-account workflows.
- Revoke sessions transactionally when access is restricted.
- Require reason codes and recent MFA for destructive actions.

### 7.3 Trip and Vehicle Management

- Complete edit, soft delete, restore, bulk operations, and export.
- Add source/OCR diagnostics and before/after history.
- Protect immutable ownership and historical accounting fields.
- Add vehicle archive and correction workflows.

### 7.4 RBAC and Admin Management

- Complete custom role create, update, clone, and delete.
- Protect system roles.
- Add permission grouping and search.
- Show permission impact before saving.
- Invalidate sessions after role changes.
- Add admin creation, role assignment, activation, deactivation, MFA reset, and session revocation.
- Prevent removal of the final active Super Admin.

### 7.5 Audit

- Ensure all privileged mutations use one audit schema.
- Add global filters by actor, role, action, target, reason code, IP, and date.
- Add target-specific timelines.
- Add export with permission checks.
- Add monthly partitioning and retention.
- Add HMAC chaining or another tamper-evidence mechanism.
- Add verifier job and alert on chain failure.
- Prohibit application-level update/delete of audit rows.

### 7.6 Settings and Catalogues

- Validate settings by registered key and schema.
- Add environment-safe feature flags only after a feature-flag model is approved.
- Complete App Source management.
- Complete Maintenance Item management.
- Add OCR thresholds and operational settings with constrained ranges.
- Add per-admin saved views, density, locale, timezone, and notification preferences.

### 7.7 Admin UX System

- Standardize data table:
  - Server pagination.
  - Sort.
  - Filters.
  - Column visibility.
  - Density.
  - Bulk selection.
  - Export.
  - Keyboard navigation.
- Standardize confirm dialogs with reason collection.
- Standardize permission, empty, loading, error, and stale-data states.
- Add Cmd-K navigation and saved-view search.
- Complete Arabic/English admin localization and RTL.
- Keep dangerous actions desktop-first while preserving urgent mobile support/moderation actions.

### 7.8 Web Integration Impact

- Handle suspended, blacklisted, anonymized, or session-revoked account states with explicit screens instead of generic API errors.
- Refresh or invalidate driver data after an administrator corrects trips, vehicles, profile fields, support status, or moderation state.
- Show driver-visible reasons only when policy permits; keep internal admin notes private.
- Surface data-export readiness and secure download expiry.
- Surface support replies, moderation outcomes, and account-security notices through notifications and deep links.
- Prevent cached or offline data from restoring access to restricted operations.
- Reconcile optimistic or queued mutations when an admin has changed or archived the target entity.
- Add E2E coverage proving admin actions produce the expected driver-facing state.

### 7.9 API

- Fill missing admin endpoints required by the completed UI.
- Ensure every endpoint has an explicit permission.
- Require MFA or recent authentication for sensitive actions.
- Add bulk-operation envelope records plus per-target audit records.
- Add asynchronous jobs for large exports, rebuilds, and bulk changes.
- Add per-admin and per-action rate limits.

### 7.10 Tests

- Generated endpoint-to-permission coverage test.
- Role-by-route and role-by-control E2E tests.
- Bulk partial-failure and retry tests.
- Last-SuperAdmin protection tests.
- Audit immutability and tamper-detection tests.
- Saved view and table-state tests.
- Admin accessibility and RTL tests.

### 7.11 Exit Criteria

- Operators can perform daily work without direct database access.
- Every mutation is permission-checked, reasoned, and audited.
- All five system roles see and can execute exactly their allowed scope.
- Audit history is searchable, exportable, retained, and tamper-evident.

## Phase 8 - Offline, PWA, Synchronization, Performance, Accessibility, and Observability

**Priority:** P1 before production scale  
**Depends on:** stable domain behavior  
**Goal:** make the platform resilient on unreliable networks and operable in production.

### 8.1 API - Synchronization and Idempotency

- Define `/sync/pull` cursor semantics and conflict metadata.
- Define `/sync/push` operation envelope and per-operation result.
- Require stable client mutation IDs.
- Make retries safe for all queued write types.
- Define conflict policy by entity rather than one generic policy.
- Add server timestamps and version fields where conflict detection needs them.
- Bound sync batch size and payload size.

### 8.2 Web - Offline and PWA

- Verify manifest, icons, install prompt, update prompt, and offline fallback.
- Define caching by resource:
  - Network-first for API reads with bounded timeout.
  - Cache-first for immutable assets and fonts.
  - No caching of sensitive auth responses.
- Persist only approved query data.
- Add an offline mutation queue for supported driver writes.
- Show pending, syncing, failed, and conflict states.
- Preserve user edits during network loss.
- Prevent duplicate writes after reconnect.
- Add service-worker version migration and cache cleanup.

### 8.3 Web - Performance

- Set budgets for initial JS, route chunks, images, and fonts.
- Lazy-load non-critical routes and charts.
- Virtualize long trip and notification lists if needed.
- Avoid unnecessary rerenders through selectors and memoization.
- Measure Core Web Vitals on representative low-end Android devices.
- Optimize OCR image preprocessing and upload memory use.
- Respect reduced motion.

### 8.4 Admin - Performance and Resilience

- Keep all large tables server-driven.
- Add request cancellation for changing filters.
- Add background export status rather than blocking downloads.
- Add stale-data indicators and manual refresh.
- Add graceful degradation when analytics or health dependencies fail.
- Add read-only cached access only where security policy allows it.

### 8.5 API - Observability

- Add structured JSON logging.
- Add request and correlation IDs.
- Add sanitized error reporting.
- Add metrics for:
  - Request count, latency, and errors.
  - Database pool and query latency.
  - OCR calls, latency, confidence, and failure.
  - Mail delivery.
  - Scheduled jobs.
  - Sync queue.
  - Auth failures and refresh reuse.
  - Admin actions and forbidden attempts.
- Add job heartbeats.
- Complete liveness and readiness checks.
- Add alert thresholds and deduplication.

### 8.6 Accessibility and Localization

- Meet WCAG 2.1 AA.
- Verify keyboard access, focus visibility, labels, dialogs, tables, charts, and toasts.
- Ensure color is never the only status signal.
- Complete Arabic and English translation coverage.
- Verify logical CSS direction and mixed Arabic/number rendering.
- Verify timezone and locale formatting.

### 8.7 Security Hardening

- Add CSP, secure headers, CORS allowlists, and trusted proxy configuration.
- Add dependency and secret scanning.
- Add upload MIME, signature, size, and decompression-bomb protection.
- Add SQL injection, mass assignment, XSS, CSRF, SSRF, and path traversal tests.
- Redact secrets, tokens, passwords, MFA secrets, images, and private content from logs.
- Define retention and deletion for personal data.

### 8.8 Exit Criteria

- Supported writes survive offline retry without duplication.
- PWA install/update/offline behavior passes E2E.
- Production metrics and alerts cover critical dependencies.
- Web and admin meet accessibility, localization, and performance budgets.
- Security tests have no unresolved critical or high findings.

## Phase 9 - Revenue, Subscriptions, Entitlements, and Commercial Analytics

**Priority:** P3  
**Depends on:** approved pricing and payment provider  
**Goal:** add billing as a first-class domain without coupling product logic to one provider.

### 9.1 Product Decisions

- Define plans, prices, currencies, trials, grace periods, cancellations, refunds, taxes, coupons, and failed-payment policy.
- Define free and paid feature entitlements.
- Define grandfathering and plan migration.
- Select payment provider and supported countries.

### 9.2 Data Layer

- Add `SubscriptionPlan`.
- Add `Subscription`.
- Add `Invoice`.
- Add provider payment/event record.
- Add `Coupon` and `CouponRedemption`.
- Add entitlement snapshots or derivation strategy.
- Add indexes for provider IDs, user, status, renewal, invoice date, and coupon.

### 9.3 API

- Add plan listing and checkout/session initiation.
- Add customer portal integration if supported.
- Add idempotent webhook ingestion.
- Verify webhook signatures.
- Handle duplicate, delayed, reordered, and missing events.
- Reconcile provider state with local state.
- Add entitlement checks at feature boundaries.
- Add trial, upgrade, downgrade, cancel, resume, refund, and payment-retry workflows.
- Keep provider payloads behind an adapter.

### 9.4 Web

- Add pricing and plan comparison.
- Add subscription status in Settings.
- Add upgrade, downgrade, cancel, resume, and payment-update flows.
- Explain entitlement restrictions without losing user data.
- Add invoices and receipt access.
- Add grace-period and failed-payment messaging.

### 9.5 Admin

- Replace revenue placeholder with real dashboards.
- Add plans, subscriptions, invoices, coupons, failed payments, refunds, and reconciliation views.
- Add MRR, ARR, ARPU, churn, trial conversion, LTV, and cohort charts.
- Add finance exports.
- Restrict sensitive financial data to dedicated permissions.
- Audit all plan, coupon, refund, and entitlement mutations.

### 9.6 Tests

- Webhook signature and idempotency tests.
- Event ordering and reconciliation tests.
- Entitlement tests for every plan and lifecycle state.
- Upgrade/downgrade proration tests.
- Failed-payment and grace-period tests.
- Revenue reconciliation tests.
- Web and admin billing E2E with provider sandbox.

### 9.7 Exit Criteria

- Subscription state is correct under all event orderings.
- Product access follows entitlements consistently.
- Revenue reports reconcile with provider totals.
- Billing failures do not delete or corrupt driver data.

## Phase 10 - Production Release, Deployment, Recovery, and Operations

**Priority:** P0 for launch  
**Depends on:** selected release phases  
**Goal:** deploy and operate the selected scope safely.

### 10.1 Infrastructure

- Define production and staging topology.
- Deploy API, web, and admin independently.
- Use separate web and admin origins and CSP policies.
- Use managed PostgreSQL or a documented backup-capable deployment.
- Add object storage only for approved attachments or OCR retention.
- Add a background job platform when campaigns, exports, or rebuilds require it.

### 10.2 API Deployment

- Build the API in a multi-stage container with Prisma generation in the build stage.
- Run the API as a non-root user.
- Inject secrets through the deployment platform, never through committed environment files.
- Run migrations as a one-shot release job before routing traffic to the new API.
- Expose separate liveness and readiness probes.
- Drain existing connections during rolling deploys.
- Pin runtime and native dependencies required by Sharp and Prisma.
- Publish API image and migration identifiers with the release.

### 10.3 Web Deployment

- Build `apps/web` as its own immutable static artifact.
- Inject only public build-time configuration.
- Deploy behind its own CDN origin and cache policy.
- Set SPA fallback without intercepting static PWA assets.
- Version service-worker caches and verify old-cache cleanup.
- Add source maps to the error-reporting service without exposing them publicly.
- Verify robots, sitemap, canonical URL, manifest, icons, and offline page.
- Run post-deploy checks for auth redirect, dashboard, lazy routes, OCR upload shell, and PWA registration.

### 10.4 Admin Deployment

- Build `apps/admin` as a separate immutable static artifact.
- Deploy on a distinct hostname and CDN origin.
- Apply a stricter CSP and no-index headers.
- Optionally place the admin origin behind Cloudflare Access, VPN, or an IP policy.
- Do not share driver-web caches, service workers, storage keys, or deployment buckets.
- Display environment, build SHA, and API version in the admin shell.
- Run post-deploy checks for login, MFA, permission routing, dashboard, and audit access.

### 10.5 CI/CD

- Create independent workflows for API, web, and admin.
- Run migrations as a controlled pre-deploy step.
- Add immutable build artifacts and build SHA display.
- Add staging smoke tests.
- Add production post-deploy smoke tests.
- Add rollout and rollback procedures.
- Prevent deployment when contract, migration, test, or security gates fail.

### 10.6 Database Operations

- Automate encrypted backups.
- Test point-in-time recovery if supported.
- Run restore drills.
- Document migration rollback or forward-fix procedure.
- Add data retention and pruning jobs.
- Verify indexes against production-like query volumes.

### 10.7 Monitoring and Incident Response

- Define SLOs for availability, latency, OCR success, job freshness, and notification delivery.
- Add dashboards for API, database, OCR, mail, jobs, web errors, and admin security.
- Define severity levels and escalation.
- Write runbooks for:
  - API outage.
  - Database outage or lag.
  - OCR provider outage.
  - Mail/notification outage.
  - Failed migration.
  - Compromised driver session.
  - Suspicious admin login.
  - Audit-chain failure.
  - Mass moderation event.
  - Billing webhook outage.

### 10.8 Release Verification

- Run driver critical-path E2E.
- Run all five admin role E2E suites.
- Run migration on a production-like copy.
- Run load and soak tests.
- Run accessibility and RTL audit.
- Run security review and penetration testing.
- Verify backup restore and deployment rollback.
- Rotate demo credentials and production secrets.
- Confirm privacy policy, terms, data retention, and support contacts.

### 10.9 Exit Criteria

- Production deploy and rollback are demonstrated.
- Backup restoration is demonstrated.
- Monitoring, alerts, and on-call ownership are active.
- No unresolved critical or high security findings remain.
- Release sign-off names the exact phases and features being shipped.

# 9. Cross-Cutting Testing Plan

## 9.1 Unit Tests

- Zod contracts and error mapping.
- Money, date, phone, locale, and timezone utilities.
- OCR pipeline.
- Profit, fuel, maintenance, vehicle-cost, forecast, recommendation, and score engines.
- Permission matching and role derivation.
- State transitions for support, moderation, sessions, subscriptions, and campaigns.
- Offline conflict and queue logic.

## 9.2 Integration Tests

- Every controller with valid and invalid input.
- Ownership checks.
- Driver and admin guards.
- Prisma transactions and aggregate updates.
- Audit creation.
- Refresh rotation.
- Idempotency.
- Scheduled jobs.
- Mail and notification adapters.
- Webhook ingestion.
- Clean database migrations.

## 9.3 Contract Tests

- API response parses against shared schema.
- Web request body parses against API schema.
- Admin request body parses against API schema.
- Error codes remain backward compatible.
- Contract version mismatch is detected.

## 9.4 E2E Tests - Web

- Register and onboard.
- Login and password reset.
- Add vehicle, app, and area.
- Manual trip CRUD.
- OCR single-trip and multi-trip capture.
- Batch delete.
- Expense, fuel, maintenance, and odometer.
- Dashboard and analytics.
- Goal, planner, simulator, decisions, and score.
- Community, review, support, and notification.
- Offline queue and reconnect.
- Arabic/English, RTL/LTR, light/dark, and install/update PWA.

## 9.5 E2E Tests - Admin

- Login and MFA.
- Sidebar and route matrix for every role.
- Suspend and activate user.
- Driver inspection and recalculation.
- Trip delete and restore.
- Vehicle correction.
- Community moderation.
- Review moderation.
- Support lifecycle.
- Notification campaign lifecycle.
- Audit lookup.
- Admin and role management.
- Settings and catalogue management.
- Health and alert resolution.
- Revenue lifecycle when enabled.

## 9.6 Non-Functional Tests

- Load and soak.
- Database query plans.
- Bundle size.
- Core Web Vitals.
- Accessibility.
- RTL.
- Security.
- Backup and restore.
- Deployment rollback.
- Provider outage and retry behavior.

# 10. Feature Coverage Matrix

| Feature | API | Web | Admin | Primary Phase |
|---|---|---|---|---|
| Driver auth and password reset | Complete and harden | Complete UX | User visibility/session revoke | 2 |
| Admin auth, MFA, sessions | Complete and harden | N/A | Complete UX | 2 |
| User and driver profiles | Complete | Settings/onboarding | Search/manage/audit | 2, 7 |
| Vehicles and costs | Complete | Settings/health | Manage/correct | 4 |
| App sources and commissions | Complete | Settings | Catalogue | 4, 7 |
| Areas | Complete | Settings/selectors | Usage/manage | 4 |
| Trips | Complete | CRUD/bulk | Manage/export | 3, 7 |
| OCR | Stabilize/telemetry | Upload/review | Oversight/replay | 3 |
| Work sessions | Complete | Add surface | Inspect | 4 |
| Fuel | Complete CRUD | Log/history | Anomalies | 4 |
| Expenses | Complete | CRUD/charts | Inspect/correct | 4 |
| Maintenance | Complete | Risk/history | Catalogue/manage | 4 |
| Odometer | Complete | Log/correct | Inspect/correct | 4 |
| Dashboard | Driver and admin payloads | Driver dashboard | Admin dashboard | 5, 7 |
| Analytics | Complete | Six tabs | Platform analytics | 5 |
| Forecast | Complete | Dashboard/detail | Aggregate quality | 5 |
| Goals and planner | Complete | Planner/progress | Usage analytics | 5 |
| Profit simulator | Vehicle-cost input | Client calculator | Usage analytics | 5 |
| Recommendations | Complete/version | Decisions | Rule/usage insight | 5 |
| Driver score | Complete | Score/history | Inspect/recalculate | 5 |
| Community | Complete/report | Feed/post/react | Moderation | 6 |
| Platform reviews | Complete | Review UX | Approve/feature | 6 |
| Support | Threads/SLA | Tickets/thread | Help desk | 6 |
| Notifications | Inbox/campaigns | Inbox/preferences | Alerts/campaigns | 6 |
| RBAC | Authoritative | N/A | Roles/admins | 2, 7 |
| Audit | Write/query | N/A | Search/export | 7 |
| Settings/catalogues | Validated API | Driver preferences | Platform settings | 4, 7 |
| Sync/offline | Sync contracts | Queue/PWA | Status only | 8 |
| Health/observability | Metrics/heartbeats | Error reporting | Health/alerts | 8 |
| I18n/theme/accessibility | Locale contracts | Full support | Full support | all, gate in 8 |
| Revenue/subscriptions | Billing domain | Subscription UX | Revenue ops | 9 |
| Deployment/recovery | API deploy | Web deploy | Admin deploy | 10 |

# 11. Delivery and Parallelization Rules

- One feature slice should include API, web/admin consumers, and tests in the same delivery whenever possible.
- Backend-only endpoints without an approved consumer or operational need should not be added speculatively.
- Web and admin implementation may begin after the feature contract is approved.
- Shared contract and schema changes must update every consumer in the same pull request.
- Phase 3 OCR and Phase 4 operating-cost work may use separate teams after canonical trip money semantics are fixed.
- Phase 6 communication work may run beside late Phase 4 work.
- Phase 7 admin work should be delivered by domain slice, not as one large final frontend rewrite.
- Phase 8 observability begins early for new features even though the formal hardening gate is later.
- Phase 9 remains blocked until commercial decisions are explicit.

# 12. Definition of Done

A feature or phase is complete only when:

- Product rules and edge cases are documented.
- Database migration and rollback/forward-fix notes exist.
- Shared contracts exist and all consumers use them.
- API authorization, ownership, validation, idempotency, and audit are complete.
- Web and admin include loading, empty, error, offline, forbidden, and success states as applicable.
- Arabic and English copy is complete.
- Keyboard, screen reader, RTL, and reduced-motion behavior is verified.
- Unit, integration, contract, and required E2E tests pass.
- Metrics, logs, alerts, and runbook updates exist.
- Typecheck, lint, test, migration, and production build gates pass in CI.
- Documentation matches the shipped behavior.

# 13. Immediate Execution Queue

Execute the next work in this exact order:

1. Fix the 10 current OCR test failures and document canonical trip financial semantics.
2. Add the root `verify` command and CI quality gates.
3. Build the shared contract and ESLint boundary packages.
4. Replace fake admin MFA and add driver/admin auth integration tests.
5. Add RBAC endpoint coverage and audit coverage tests.
6. Reconcile all active web and admin clients with shared contracts.
7. Complete trip/OCR telemetry and admin OCR oversight.
8. Complete fuel CRUD, work-session UI, and operating-cost data quality.
9. Complete support threads and community reports/moderation.
10. Complete admin operational workflows by domain.
11. Add offline queue, observability, accessibility, and performance gates.
12. Start revenue only after pricing and provider approval.

# 14. Decisions Required Before Dependent Work

- Canonical meaning of trip gross, received, commission, and adjustments.
- Admin cookie and CSRF architecture.
- OCR image retention and privacy policy.
- Whether driver write operations must work fully offline or only selected operations.
- Push notification provider and background job platform.
- Attachment storage policy for support.
- Analytics event retention, consent, and privacy rules.
- Peer benchmarking minimum cohort size.
- Production hosting and managed-service choices.
- Billing provider, plans, currencies, taxes, and entitlements.
