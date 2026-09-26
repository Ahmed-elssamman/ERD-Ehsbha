# Implementation Plan: Shared Platform Foundation and API Contracts

**Branch**: `001-baseline-governance` | **Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-shared-platform-contracts/spec.md`

> Planning note: Spec Kit resolved feature `002-shared-platform-contracts` while Git remains on
> `001-baseline-governance`. Planning may complete here, but implementation must move to the
> feature branch before source changes begin.

## Summary

Create four real workspace packages for executable API contracts, framework-neutral value types,
architecture lint rules, and visual tokens. Build a generated contract catalog over every active
API operation, migrate the NestJS boundary and both browser clients to runtime-validated shared
Zod schemas, standardize envelopes, request identity, version metadata, errors, pagination, retry
rules, and idempotency, and add deterministic contract and dependency verification to the root
quality gate. The initial migration is one coordinated API, driver web, and admin deployment;
subsequent additive response changes remain independently deployable within contract major version
1.

## Technical Context

**Language/Version**: TypeScript 5.7 on Node.js 22 LTS

**Primary Dependencies**: npm workspaces; Zod 3.23.8; NestJS 11; React 19; Axios 1.7; TanStack
Query 5.62; Prisma 6; ESLint 10; proposed `@asteasolutions/zod-to-openapi` 7.3.4 for the pinned
Zod 3 line; proposed dependency-cruiser for dependency graph enforcement

**Storage**: PostgreSQL through Prisma for a narrowly scoped idempotency ledger; generated JSON,
OpenAPI, and Markdown artifacts for the contract catalog and verification evidence

**Testing**: Jest 29 API and contract tests; Node test runner for repository verification;
representative client parsing/retry tests; controlled dependency-rule fixtures; existing
integration, smoke, production build, route audit, and artifact measurement gates

**Target Platform**: Windows-authoritative development and CI; independently built Node API,
driver browser application, and administration browser application

**Project Type**: npm monorepo with one web service, two React applications, and four shared
workspace packages

**Performance Goals**: Preserve API read p95 <= 300 ms and write p95 <= 500 ms excluding provider
latency; keep contract validation overhead below a 10% regression on representative operations;
keep initial web JavaScript <= 250 KiB compressed and lazy route chunks <= 150 KiB; keep contract
and boundary verification inside the existing root verification budget

**Constraints**: Initial API/web/admin contract cutover is coordinated; request objects reject
unknown fields; response objects tolerate unknown additive fields; pagination defaults to 25 and
is capped at 100 unless explicitly approved; unsupported contract major versions fail closed;
money remains integer piastres, distance meters, duration seconds, and instants ISO-8601 UTC;
authentication realms and user-visible behavior are not redesigned

**Scale/Scope**: 161 discovered API routes across 40 controllers; approximately 83 driver and 68
admin transport call sites; all active operations and consumers must appear in the catalog;
scaffold-only, obsolete, or inactive operations require explicit inventory status, owner, and
follow-up

## Constitution Check

*GATE: Passed before Phase 0 research and passed again after Phase 1 design.*

| Gate | Status | Evidence |
|---|---|---|
| Feature-first boundary and dependency direction | PASS | Contracts are split into framework-neutral packages, API delivery adapters, and application-owned client adapters. The allowed dependency graph is explicit and mechanically checked. |
| Domain/application independence | PASS | Shared schemas describe boundary data only. They import no React, NestJS, Prisma, Axios, browser state, or provider SDKs. |
| Shared contracts and compatibility | PASS | Catalog entries identify operation, consumers, schema, version, compatibility class, migration state, and coordinated release ownership. |
| Strict TypeScript and architecture enforcement | PASS | Packages use strict composite projects; forbidden imports, undeclared dependencies, cross-app imports, and cycles are blocking checks. |
| Security and privacy | PASS | Driver/admin realms remain distinct; unknown requests fail closed; response and error schemas exclude private internals; idempotency is scoped by realm, actor, and operation; request IDs contain no personal data. |
| Test layers | PASS | Unit, contract, integration, client behavior, security, boundary fixture, OpenAPI freshness, build, route, and artifact checks are planned. No new browser journey is introduced. |
| Performance and scale | PASS | Validation overhead, package artifact size, API latency, 161-route catalog coverage, and frontend bundle budgets are measurable gates. |
| Operations and recovery | PASS | Request IDs bind responses to logs; generated artifacts are deterministic; the rollout is coordinated; rollback restores all three prior artifacts and database migration compatibility. |
| Accessibility, localization, offline, failure states | PASS | Shared contracts carry locale/message keys without presentation behavior. Existing Arabic/English, RTL/LTR, offline, and screen behavior must remain unchanged; normalized failures include distinct recovery categories. |

## Project Structure

### Documentation (this feature)

```text
specs/002-shared-platform-contracts/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- boundary-rules.md
|   |-- client-data-rules.md
|   |-- contract-catalog.schema.json
|   |-- error-catalog.md
|   `-- platform-http.md
`-- tasks.md
```

### Source Code (repository root)

```text
packages/
|-- shared-types/
|   |-- package.json
|   |-- tsconfig*.json
|   `-- src/
|       |-- identifiers/
|       |-- units/
|       |-- locale.ts
|       `-- index.ts
|-- api-contracts/
|   |-- package.json
|   |-- tsconfig*.json
|   `-- src/
|       |-- core/
|       |-- catalog/
|       |-- domains/
|       |-- openapi/
|       `-- index.ts
|-- eslint-config/
|   |-- package.json
|   `-- index.mjs
`-- ui-tokens/
    |-- package.json
    `-- src/

apps/api/
|-- prisma/
|   |-- schema.prisma
|   `-- migrations/
`-- src/
    |-- common/
    |   |-- contracts/
    |   |-- filters/
    |   |-- interceptors/
    |   `-- middleware/
    `-- modules/
        `-- idempotency/

apps/web/src/features/
|-- platform-api/
`-- <domain>/api/

apps/admin/src/features/
|-- platform-api/
`-- <domain>/api/

scripts/
|-- contracts/
|   |-- generate-catalog.mjs
|   |-- generate-openapi.mjs
|   |-- inventory-consumers.mjs
|   `-- verify-contracts.mjs
`-- verification/
    |-- verify-boundaries.mjs
    `-- verify-frontend-isolation.mjs
```

**Structure Decision**: `shared-types` is the dependency leaf and contains only branded units,
identifiers, and exchanged enums. `api-contracts` depends on Zod and `shared-types` and exposes
domain subpath exports so browser consumers do not import the entire catalog. `eslint-config`
contains reusable source rules, while repository-level dependency-cruiser rules inspect aliases,
dynamic imports, transitive dependencies, and cycles. Transport-specific Axios and NestJS adapters
stay inside their owning applications. Shared packages emit CommonJS, ESM, and declarations with
TypeScript project builds so both the CommonJS API and ESM browser builds consume the same source.

## Implementation Design

### 1. Shared Package Foundation

- Create workspace manifests, strict TypeScript configs, exports, tests, and build scripts for all
  four packages.
- Use a solution TypeScript project with references so shared packages build before applications.
- Publish domain subpaths such as `@ehsbha/api-contracts/auth`, `/trips`, `/admin/users`, and
  `/core`; avoid a browser-facing catch-all import that pulls every schema into one bundle.
- Keep runtime Zod schemas in `api-contracts`; derive TypeScript types with `z.infer`.
- Keep `shared-types` free of Zod and application dependencies. Runtime enum value arrays may be
  exported only when they are protocol values used by multiple contracts.
- Limit `ui-tokens` to colors, typography, spacing, motion, and direction-safe token values.

### 2. Contract Registry and Generated Catalog

- Define each active operation once with operation ID, HTTP method/path, realm, lifecycle status,
  request schemas, success data schema, failure codes, pagination, units, idempotency, consumers,
  and compatibility classification.
- Generate the machine-readable catalog and OpenAPI document from the same registry.
- Compare the registry against the existing TypeScript controller extractor and frontend client
  inventory. Missing active routes, undocumented client calls, stale local DTOs, and orphaned
  catalog entries block acceptance.
- Mark scaffold, obsolete, and inactive operations explicitly; do not present them as production
  contracts.
- Treat generated artifacts as build outputs: deterministic, verified for freshness, and not
  manually edited.

### 3. Shared HTTP Boundary

- Standardize success payloads as `{ data, meta }` and failure payloads as `{ error, meta }`.
- Include `requestId`, `serverTime`, `apiVersion`, and semantic `contractVersion` in `meta`; expose
  `requestId` and version metadata in response headers for diagnostics and non-JSON responses.
- Generate a UUID request ID when no valid inbound ID exists. Accept only bounded,
  privacy-safe inbound IDs and place the same value in structured logs and responses.
- Use strict request schemas at every body/query/parameter boundary. Response data schemas use
  passthrough object behavior so additive fields within the same contract major remain compatible.
- Treat an unsupported contract major as `CONTRACT_VERSION_MISMATCH`; clients reject the body,
  preserve request ID, do not retry automatically, and expose a distinct application outcome.
- Normalize Prisma, framework, provider, and unexpected failures into governed public error codes
  while logging only sanitized diagnostic context.

### 4. Values, Pagination, and Errors

- Introduce branded TypeScript primitives for piastres, meters, seconds, and security-realm IDs.
- Serialize all instants as UTC strings and keep calendar dates as `YYYY-MM-DD`.
- Set the platform pagination default to 25 and maximum to 100. Every list operation selects
  cursor or offset mode and defines stable ordering, filter/sort binding, and empty-page behavior.
- Build one error catalog mapping stable codes to HTTP status, category, retry policy,
  message-key expectation, field detail shape, and allowed realms.
- Keep user-facing Arabic/English copy in applications; contracts exchange stable message keys and
  safe fallback text only.

### 5. Idempotent Writes

- Add one `IdempotencyRecord` table scoped by realm, actor, operation, and key. Store a canonical
  request hash, execution state, bounded replay response, timestamps, and expiry.
- Validate authentication, authorization, ownership, and request schema before claiming a key.
- Return the stored result for the same key and payload; return `IDEMPOTENCY_KEY_REUSED` for a
  changed payload; return `IDEMPOTENCY_IN_PROGRESS` for a concurrent duplicate.
- Store successful and deterministic completed outcomes; do not permanently cache transient
  infrastructure failures. Default retention is 24 hours unless an operation documents a longer
  window.
- Do not place credentials, refresh tokens, MFA material, raw OCR images, or private provider
  payloads in replay storage. Auth/token operations retain their domain-specific replay controls.
- Migrate existing `clientMutationId` write behavior through the shared service, preserving
  current records while replacing globally scoped uniqueness for new operations.

### 6. Driver and Admin Client Behavior

- Replace unchecked `unwrap<T>` casts and admin response mutation with schema-aware parsing that
  returns typed data or a normalized contract error.
- Keep Axios instances application-owned because their authentication realms, token refresh, and
  session outcomes differ.
- Configure TanStack Query to retry safe reads at most twice for documented transient network,
  408, 429, 502, 503, and 504 outcomes, respecting `Retry-After` and exponential backoff.
- Never retry validation, authentication, authorization, deterministic conflict, or contract
  mismatch errors automatically. Retry writes only through an operation that declares idempotency.
- Move endpoint interfaces from the current monolithic modules into domain-owned clients that
  import shared schemas and use stable query-key factories and explicit invalidation maps.
- Preserve distinct admin outcomes for forbidden, stale permissions, MFA required, and session
  expiry.

### 7. Boundary Enforcement

- Add ESLint rules for immediate developer feedback on cross-app and frontend-to-server imports.
- Add dependency-cruiser rules for aliases, dynamic imports, transitive dependencies, undeclared
  package dependencies, and cycles.
- Add production artifact scans proving driver code is absent from admin output and admin code is
  absent from driver output.
- Add controlled violation fixtures so each rule is proven to fail for the intended dependency
  path and pass for valid shared imports.

### 8. Verification and Rollout

- Replace the Phase 0 `test:contract` placeholder with blocking package, registry, service/client
  agreement, security, compatibility, and freshness tests.
- Add `verify:contracts` and `verify:boundaries` before application builds in `npm run verify`.
- Measure API validation overhead and per-package compressed output; compare both frontend builds
  with the Phase 0 baseline.
- Deliver in one coordinated release: migrate and verify API, then driver client, then admin
  client in source order, but deploy all three artifacts together after the catalog is complete.
- Rollback restores all three previous artifacts together. The database migration must remain
  backward compatible until the rollback window closes; the new idempotency table is additive.

## Delivery Sequence

1. Create shared package manifests, build graph, and dependency rules.
2. Define core values, envelopes, versions, errors, pagination, and catalog metadata.
3. Generate catalog/OpenAPI and inventory all active routes and consumers.
4. Add request identity and shared API response/error adapters.
5. Add the scoped idempotency ledger and migrate representative retryable writes.
6. Migrate driver contracts and client behavior by domain.
7. Migrate admin contracts and client behavior by domain.
8. Remove local duplicates and client coercions after repository-wide inventory reaches 100%.
9. Enable contract, boundary, artifact-isolation, compatibility, and performance gates.
10. Run the coordinated release rehearsal, rollback rehearsal, and final root verification.

## Post-Design Constitution Check

All gates remain PASS. The design adds one narrowly scoped persistence model rather than changing
domain records, keeps framework adapters inside applications, makes every contract consumer and
deployment dependency visible, and adds blocking security, compatibility, architecture, and
performance evidence. Implementation must correct the current branch mismatch before source work.

## Complexity Tracking

No constitution violations require justification.
