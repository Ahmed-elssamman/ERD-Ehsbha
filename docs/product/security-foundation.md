# Driver data isolation and dependency hardening

This work is part of the complete roadmap in `engineering-roadmap.md`. It does not
establish production readiness for OCR, the browser experience, or the platform.

## Data isolation

Trip, fuel, expense, and shift retry keys now use `(driverId, clientMutationId)`.
The same key from a second driver creates that driver's own record rather than
returning another driver's financial data. Reusing a key with changed values
returns a conflict. Existing key values are retained.

`common/authorization/driver-ownership.ts` checks vehicle, driver-app, and area
ownership in service entry points, including calls from OCR batches and sync.
Create and update paths enforce these checks. Missing and foreign resources both
produce the governed not-found response, without disclosing their owner.

`scripts/verify-driver-isolation.ts` exercises the real services and PostgreSQL:
independent driver keys, same-driver replay, conflicting values, foreign keys,
updates, batch and sync paths, concurrent uniqueness, and unchanged aggregates
after rejected writes. It runs inside the integration command. A standalone
`test:driver-isolation` command refuses databases without the `ehsbha_test_` prefix.

The API and seed/integration scripts choose the Neon adapter for `.neon.tech`
hosts and the native Prisma PostgreSQL client for ordinary PostgreSQL. This
preserves hosted behavior and permits a local disposable integration database.

## Deployment and rollback

Deploy the schema migration `20260917090000_scope_driver_mutation_keys` and rebuilt
API together, with writes paused during the cutover. Regenerate Prisma Client from
the current schema before building. The migration creates composite indexes
before removing the global indexes, within one transaction; it deletes no data.

Do not run the old API after the migration: it still assumes globally unique
keys. A rollback must retain owner-scoped lookup behavior. Reintroducing global
uniqueness requires checking for cross-driver key collisions and planning a
data-preserving reconciliation; it must not silently delete or rewrite records.
No configured development or production database was migrated by this work.
Verification uses `ehsbha_test_driver_isolation` on local port 55439.

Driver access tokens now carry the persisted refresh-session ID. Existing access
tokens without that claim are rejected; a still-valid refresh token can obtain
the new format through the existing client refresh flow. Every protected driver
request checks current account status, session expiry and revocation, and reads
identity from the database. Account suspension/deletion, logout and password reset
therefore affect access tokens immediately. Admin access-session revocation still
requires a separate review; these driver guarantees do not establish that behavior
for admin JWTs.

Refresh consumption and replacement run in one transaction. A concurrent reuse
revokes active sessions and commits that revocation before returning a failure.
Password-reset consumption checks unused state, attempt count and expiry inside
the password-change transaction. Concurrent use of one code succeeds at most once.
Cross-tab refresh coordination remains to be implemented for the best experience
when multiple tabs share one refresh token.

Authentication error codes with existing localized recovery messages are now in
the governed registry and operation catalog. Invalid credentials and recovery
errors retain their intended 401/404 responses instead of becoming 502 contract
errors. Recovery codes are neither logged nor returned outside `NODE_ENV=test`.
SMTP must be configured for recovery in development and production; a missing or
failed transport returns a safe service-unavailable response. Test delivery uses
no external email service.

Token lifetimes accept positive values with `s`, `m`, `h` or `d` units (for
example `15m` or `30d`). Unsupported formats fail environment validation instead
of silently falling back to a long access-token lifetime.

## Browser cache privacy

Driver query caches use a separate client and persistence key per account. Guest
queries are not persisted. Leaving an account clears its client and stored cache;
the former shared `ehsbha.rq` entry is discarded. The same account can restore its
own persisted data after a reload. Administrator clients also reset on account
changes. Delayed refresh responses cannot restore a logged-out account or clear a
newly signed-in one, and failed login requests do not refresh another session.

API responses carry `Cache-Control: no-store`. The new service worker uses
`NetworkOnly` for API requests, deletes the old `api-cache` on activation, and
activates immediately to replace the unsafe caching policy. The static PWA shell
and account-scoped query persistence remain available offline. Verify service
worker activation and account switching in real browsers before release; current
unit tests do not prove browser lifecycle behavior. Offline mutation queues and
draft isolation remain separate roadmap work.

## Dependency decisions

The initial production audit found 15 advisories (12 high, 2 moderate, 1 low).
Semver-compatible updates were applied, plus reviewed upgrades to Multer 2.4,
Sharp 0.35.4, and Nodemailer 10.0.10. Node requirements were checked against the
actual Node 24.18.0 development runtime and the Node 22 LTS project target.

- Multer retains memory storage and the multipart interceptor interface. Its
  patched release fixes malformed/aborted multipart and resource-consumption
  weaknesses. NestJS 11 pins an older Multer, so an explicit override is required.
- Sharp retains the used rotate/resize/median/linear/sharpen/PNG APIs. Version 0.35
  removes deprecated APIs unused here and requires Node 20.9 or newer. The patched
  native codecs are important because screenshots are untrusted input.
- Nodemailer 10 requires Node 20 or newer and validates remote-content TLS by
  default. Existing SMTP transport calls remain supported; TLS validation remains
  enabled. No external email is sent during verification.
- Prisma 6 configuration uses `deepmerge` on ordinary configuration records. Its
  deepmerge-ts 8 override fixes recursive-graph exhaustion. The changed Map merge
  semantics and renamed custom-merger types are not used by this repository;
  migrations, client generation, and the integration suite verify compatibility.
- Vitest 5 removes the vulnerable older test-server dependency chain. Workspace
  overrides keep one version; package test discovery excludes compiled copies.
  Supported runtimes are Node 22.12+, Node 24, and Node 26+ as enforced by the
  repository prerequisite checker. Ajv 8 is explicitly declared because the
  report validator must not depend on an incompatible transitive Ajv 6 install.

The final installed production and development dependency audit reports zero
known advisories. This is dependency evidence, not a claim that application
security or production readiness is complete.

Official sources retrieved 2026-09-17:

- <https://github.com/expressjs/multer/releases/tag/v2.4.0>
- <https://github.com/lovell/sharp/releases/tag/v0.35.0>
- <https://github.com/lovell/sharp/releases/tag/v0.35.4>
- <https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md>
- <https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0>
- <https://github.com/vitest-dev/vitest/blob/main/docs/guide/migration/index.md>

## Verification scope

The health HTTP test now constructs the actual health controller with a controlled
database adapter, without starting unrelated application modules or depending on
external credentials. The integration command separately verifies full API
startup with reachable and unreachable PostgreSQL.

The secret scanner recognizes browser storage reads as code expressions only in
JavaScript/TypeScript source. Regression tests still catch adjacent literal
credentials and storage-looking values in configuration files. An error-redaction
fixture is explicitly marked as test data; its no-disclosure assertions remain.

Current focused checks: 225 API tests, 27 browser-client/cache unit tests, 80 shared
package tests, and 589 verification tests passed. Real PostgreSQL service tests
also passed for ownership, replay, account status, access-session revocation,
refresh rotation/reuse, concurrent refresh and competing password resets.
Nodemailer tests compose a real in-memory stream message using the patched
dependency and exercise missing/failed SMTP without sending external mail.
The root gate passed in run `2026-09-16T22-15-59-301Z-348`, including all 41 smoke
checks, real database integration, application builds, contracts, boundaries,
route/artifact audits and the repository security scan. The ten additional token
duration cases passed in the subsequent 225-test API suite. This is diagnostic
evidence on a dirty worktree; the root's E2E placeholder does not satisfy browser
acceptance. See the roadmap for log paths.

The first complete root run caught outdated smoke expectations: trip creation
omitted the required idempotency header, and delete still expected 204 despite the
governed success envelope returning 200. Smoke now checks the acknowledged delete
envelope, same-ID replay and aggregate restoration. Authentication failures from
that run exposed the registry defect described above; it was fixed in production
code, not waived in the test. The consumer inventory now excludes test-file calls,
with a regression test, so the catalog describes runtime consumers only.

Still required by the full goal: provider-specific financial normalization,
correction/audit history, concurrency-safe aggregate updates, complete OCR capture,
admin session revocation, browser lifecycle/E2E checks, field-accuracy benchmarks, and every
remaining product/experience acceptance item in the roadmap.

## Files created or changed in this stage

This list identifies this stage's work, not all changes inherited in the dirty
workspace. Generated outputs and verification logs remain under
`verification-output/`.

| Area | Files |
| --- | --- |
| Ownership and retry integrity | `apps/api/src/common/authorization/driver-ownership.ts` (new); `apps/api/src/common/utils/mutation-payload.ts` and `.spec.ts` (new); `apps/api/src/modules/trips/trips.service.ts`; `apps/api/src/modules/fuel/fuel.service.ts`; `apps/api/src/modules/expenses/expenses.service.ts`; `apps/api/src/modules/sessions/sessions.service.ts` |
| Database | `apps/api/prisma/schema.prisma`; `apps/api/prisma/migrations/20260917090000_scope_driver_mutation_keys/migration.sql` (new); `apps/api/src/prisma/client-options.ts` and `.spec.ts` (new); `apps/api/src/prisma/prisma.service.ts`; `apps/api/prisma/seed.ts`; `apps/api/prisma/seed-admin.ts` |
| Authentication and privacy headers | `apps/api/src/modules/auth/auth.service.ts`; `apps/api/src/modules/auth/jwt.strategy.ts`; `apps/api/src/modules/mailer/mailer.service.ts` and `.spec.ts` (new test); `apps/api/src/config/env.ts` and `.spec.ts` (new test); `apps/api/src/common/middleware/request-context.middleware.ts`; `packages/api-contracts/src/core/errors.ts`; `packages/api-contracts/src/domains/auth-profile.ts` |
| Driver browser | `apps/web/src/lib/api/client.ts` and `.spec.ts` (new test); `apps/web/src/providers/query-provider.tsx`; `apps/web/src/providers/account-query-cache.ts` and `.spec.ts` (new); `apps/web/src/components/layout/app-layout.tsx`; `apps/web/src/pages/settings/settings.tsx`; `apps/web/src/pages/auth/forgot-password.tsx`; `apps/web/vite.config.ts`; `apps/web/public/clear-legacy-api-cache.js` (new) |
| Admin browser | `apps/admin/src/lib/api/admin-client.ts` and `.spec.ts` (new test); `apps/admin/src/providers/query-provider.tsx` and `query-provider.control.ts` (new); `apps/admin/src/main.tsx` |
| Integration and smoke | `apps/api/scripts/verify-driver-isolation.ts`, `verify-auth-security.ts`, `test-driver-isolation.ts` (new); `apps/api/scripts/test-integration.ts`; `apps/api/scripts/smoke.ts`; `apps/api/src/modules/health/health.integration.spec.ts`; `apps/api/src/common/contracts/admin-http-agreement.integration.spec.ts` |
| Dependency and tooling setup | `package.json`; `package-lock.json`; `apps/api/package.json`; `packages/shared-types/package.json`; `packages/api-contracts/package.json`; `packages/ui-tokens/package.json`; `packages/shared-types/vitest.config.mts` and `packages/api-contracts/vitest.config.mts` (new) |
| Verification tooling | `scripts/verification/verify.mjs`; `scripts/verification/check-prerequisites.mjs`; `scripts/verification/lib/security-scan.mjs`; `scripts/verification/lib/extract-api-consumers.mjs`; `scripts/verification/tests/check-prerequisites.test.mjs`; `scripts/verification/tests/sensitive-artifacts.test.mjs`; `scripts/verification/tests/consumer-inventory.test.mjs` (new) |
| Documentation | `docs/baseline/support-matrix.md`; `docs/product/engineering-roadmap.md`, `ocr-research.md`, and `security-foundation.md` (new) |

New implementation follows the established React/NestJS workspace, keeps shared
contracts framework-neutral, uses typed interfaces and Prisma enums, places the
new admin query configuration in a companion control file, and isolates security
helpers from UI code. Existing unrelated changes and legacy patterns are retained.

Whitespace-only cleanup removes inherited indented blank lines in admin settings;
API bootstrap, notifications and recommendations; web error boundaries, sidebar,
OCR progress/upload, dashboard animation, driver score, trip form and vehicle
health. `git diff --check` passes. The browser recovery flow also no longer prints
test recovery codes to its console.
