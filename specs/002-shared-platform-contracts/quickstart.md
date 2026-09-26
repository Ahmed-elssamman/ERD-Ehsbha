# Quickstart: Validate Shared Platform Contracts

This guide describes the end-to-end validation expected after implementation. It intentionally
does not duplicate implementation code or complete test suites.

## Prerequisites

- Supported 64-bit Windows environment
- Node.js 22 LTS and the lockfile-compatible npm release
- PostgreSQL 16 available through the repository test configuration
- Phase 0 verification prerequisites satisfied
- Work performed on the `002-shared-platform-contracts` feature branch

## Install and Generate

```powershell
npm ci
npm run api:prisma:generate
npm run packages:build
npm run contracts:generate
```

Expected:

- `shared-types`, `api-contracts`, `eslint-config`, and `ui-tokens` build independently.
- The generated contract catalog validates against
  `specs/002-shared-platform-contracts/contracts/contract-catalog.schema.json`.
- OpenAPI and catalog generation are deterministic.
- Every active extracted API route and active client call maps to a catalog entry.

## Focused Verification

```powershell
npm run packages:typecheck
npm run test:contract
npm run verify:contracts
npm run verify:boundaries
```

Expected:

- Request, success, failure, pagination, unit, date, error, version, and idempotency schemas pass.
- No local endpoint response interface competes with a migrated shared contract.
- No cross-application, frontend-to-server, private subpath, undeclared, or cyclic dependency
  exists.
- Controlled violation fixtures fail with the responsible dependency path.

## Scenario 1: Strict Requests

Submit a representative request with one valid body plus an unknown property.

Expected:

- HTTP 400 with `VALIDATION_ERROR`.
- The unknown property is not silently stripped and the mutation is not executed.
- The response and diagnostic log share the same request ID.

## Scenario 2: Additive Responses

Run a contract fixture containing every required response field plus one unknown additive field.

Expected:

- The known data parses successfully.
- The additive field does not invalidate the response.
- Removing a required field produces `CONTRACT_VIOLATION`.

## Scenario 3: Version Compatibility

Run fixtures for contract versions `1.0.0`, a later compatible `1.x` version, and `2.0.0`.

Expected:

- Supported major version 1 responses parse normally.
- Version 2 is rejected before operation data is used.
- The normalized result is `CONTRACT_VERSION_MISMATCH`.
- The client preserves request ID and does not retry automatically.

## Scenario 4: Pagination Bounds

Exercise representative cursor and offset operations without a limit, with `100`, and with `101`.

Expected:

- Omitted limit resolves to 25.
- Limit 100 is accepted.
- Limit 101 returns `VALIDATION_ERROR`.
- Empty results contain complete pagination metadata.
- A cursor reused with changed filters returns `INVALID_CURSOR`.

## Scenario 5: Error Normalization

Exercise validation, unauthenticated, forbidden, not-found, conflict, throttling, provider
failure, and unexpected failure fixtures.

Expected:

- Every response matches the shared failure envelope and governed error catalog.
- Raw framework, Prisma, provider, stack, credential, and personal details are absent.
- Driver and admin clients produce the documented distinct session and permission outcomes.

## Scenario 6: Client Retry Rules

Run representative driver and admin safe-read tests for network failure, 429, 503, validation,
forbidden, deterministic conflict, and contract mismatch.

Expected:

- Transient safe reads retry no more than twice with bounded backoff.
- `Retry-After` is respected.
- Validation, authorization, conflict, and contract mismatch do not retry.
- Non-idempotent writes do not retry automatically.

## Scenario 7: Idempotent Writes

Using a migrated retryable write:

1. Submit a valid request with a new `Idempotency-Key`.
2. Repeat the same request and key.
3. Repeat the key with a changed payload.
4. Run two same-key requests concurrently.

Expected:

- Step 1 creates one business effect.
- Step 2 returns the original result and creates no second effect.
- Step 3 returns `IDEMPOTENCY_KEY_REUSED`.
- The concurrent duplicate returns the stored result or `IDEMPOTENCY_IN_PROGRESS`.
- One actor or realm cannot replay another actor's key.

## Scenario 8: Catalog Coverage

```powershell
npm run contracts:inventory
npm run verify:contracts
```

Expected:

- All active controller routes appear exactly once.
- All active web and admin client calls identify a catalog operation.
- Scaffold, obsolete, and inactive operations include owner and follow-up.
- Generated OpenAPI paths agree with the active catalog.

## Scenario 9: Application Builds and Isolation

```powershell
npm run build
npm run verify:frontend-isolation
npm run verify:measure
```

Expected:

- API, driver web, and admin web production builds pass.
- Driver artifacts contain no admin-specific modules.
- Admin artifacts contain no driver-specific modules.
- Shared package adoption does not violate approved compressed artifact budgets.

## Full Repository Gate

```powershell
npm run verify
```

Expected:

- Contract and boundary checks are blocking rather than `not_applicable`.
- Existing integration, smoke, route, security, build, and evidence integrity checks still pass.
- Representative API latency and frontend artifact measurements remain within existing budgets or
  have an approved, time-bounded exception.

## Coordinated Release Rehearsal

Before deployment:

1. Build immutable API, driver web, and admin web artifacts from the same revision.
2. Apply the additive idempotency migration.
3. Run smoke and contract checks against the staged trio.
4. Verify all report contract major version 1.
5. Rehearse restoring all three previous artifacts while leaving the additive table in place.

Phase 1 is not released through a mixed old/new artifact set.
