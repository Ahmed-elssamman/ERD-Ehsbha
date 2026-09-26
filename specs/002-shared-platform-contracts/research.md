# Research: Shared Platform Foundation and API Contracts

## 1. Contract Source of Truth

**Decision**: Use executable Zod schemas in `packages/api-contracts` as the authoritative source.
Each operation registers request, success data, failure codes, metadata, consumers, lifecycle,
pagination, idempotency, and compatibility information in one typed catalog.

**Rationale**: The API already uses Zod 3.23.8 and both browser applications already depend on
Zod. Reusing executable schemas removes the current split between API DTOs, driver interfaces, and
admin interfaces. A registry also supports inventory and generated documentation without adding a
second handwritten contract source.

**Alternatives considered**:

- OpenAPI-first code generation: rejected because current API validation is Zod-based and a second
  authoring language would create migration and drift risk.
- TypeScript interfaces only: rejected because interfaces do not validate untrusted runtime data.
- Prisma models as contracts: rejected because persistence shape contains internal fields and does
  not represent public nullability, errors, compatibility, or authorization.

## 2. Request and Response Unknown Fields

**Decision**: All request object schemas reject unknown keys. Response object schemas preserve and
ignore unknown keys after validating all known required fields.

**Rationale**: Strict requests prevent mass assignment and accidental client typos. Passthrough
responses permit additive fields during independent deployment after the coordinated migration.
The implementation uses the equivalent Zod 3 `.strict()` and `.passthrough()` behavior while the
project remains pinned to Zod 3.

**Alternatives considered**:

- Strip unknown request keys: rejected because silently accepting unintended fields hides client
  errors and can weaken mutation safety.
- Strict responses: rejected because additive response fields would break older compatible
  clients.
- Loose requests: rejected because it increases mass-assignment and ambiguity risk.

**Primary reference**: [Zod object strictness](https://zod.dev/api#zstrictobject)

## 3. Package Build and Module Compatibility

**Decision**: Build shared runtime packages with TypeScript composite projects and separate
CommonJS and ESM outputs plus one declaration output. Use package export maps and domain subpaths.

**Rationale**: The NestJS API currently emits CommonJS while Vite consumes ESM. Dual TypeScript
outputs avoid changing application module systems and avoid adding an actively deprecated
bundler. Project references provide ordered builds and declaration-level boundaries.

**Alternatives considered**:

- ESM-only packages: rejected because the current API build is CommonJS.
- CommonJS-only packages: rejected because it weakens browser tree-shaking and package isolation.
- `tsup`: rejected because its upstream repository now states it is no longer actively
  maintained.
- Source-only workspace imports: rejected because independent package verification and clean
  application builds would depend on compiler-specific source traversal.

**Primary references**:

- [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [tsup maintenance notice](https://github.com/egoist/tsup)

## 4. Contract Catalog and OpenAPI

**Decision**: Generate both `contract-catalog.json` and OpenAPI 3.1 from the typed operation
registry. Pin `@asteasolutions/zod-to-openapi` to 7.3.4 while the repository uses Zod 3.

**Rationale**: The OpenAPI adapter documents that 7.3.4 supports Zod 3 and generates API
documentation from the same schemas used at runtime. A separate catalog is still needed for
consumer ownership, migration status, realm, idempotency, boundary, and compatibility metadata
that OpenAPI does not model directly.

**Alternatives considered**:

- Handwritten OpenAPI: rejected because 161 discovered routes make drift likely.
- Nest decorator generation: rejected because current DTOs are Zod schemas and adding duplicate
  decorator metadata would create two sources.
- Catalog only: rejected because integrators and route-level verification benefit from standard
  OpenAPI output.

**Primary reference**:
[Zod to OpenAPI Zod 3 support](https://github.com/asteasolutions/zod-to-openapi)

## 5. Envelope, Request Identity, and Versioning

**Decision**: Keep the existing top-level `data` and `error` shapes, standardize shared `meta`, and
add response headers. `meta` contains `requestId`, `serverTime`, `apiVersion`, and
`contractVersion`. Contract versions use semantic versioning starting at 1.0.0. Clients accept
supported versions within major version 1 and reject unsupported majors.

**Rationale**: Keeping the top-level shape minimizes user-visible migration risk. Request identity
must be generated before controller execution and reused by the interceptor, exception filter,
headers, and structured logs. Major-version compatibility allows additive minor releases while
failing closed on incompatible generations.

**Alternatives considered**:

- Exact version equality: rejected because compatible additive releases would unnecessarily break
  independently deployed clients.
- API path version only: rejected because `/api/v1` does not identify shared catalog evolution.
- Client-generated request IDs only: rejected because absent or unsafe input still needs a
  trustworthy server correlation value.

**Primary references**:

- [NestJS interceptors](https://docs.nestjs.com/interceptors)
- [NestJS exception filters](https://docs.nestjs.com/exception-filters)
- [Semantic Versioning 2.0.0](https://semver.org/)

## 6. Pagination

**Decision**: Retain both cursor and offset pagination, selected per operation. Apply a platform
default of 25 and maximum of 100. Cursor values are opaque and bound to operation, normalized
filters, sort, and realm.

**Rationale**: The current platform already contains cursor-oriented lists and unpaged arrays.
One forced mode would create unnecessary domain redesign. Shared bounds and metadata remove client
ambiguity while allowing each list to use the mode suited to its access pattern.

**Alternatives considered**:

- Cursor-only: rejected because small administrative reference lists and existing offset-style
  operations do not require cursor complexity.
- Offset-only: rejected because mutable feeds and operational tables can duplicate or skip rows.
- Per-operation unconstrained limits: rejected because it permits unbounded reads and inconsistent
  client behavior.

## 7. Error Catalog

**Decision**: Define one governed error registry with code, HTTP status, outcome category, retry
policy, safe fallback, optional message key, field issue schema, and allowed realms.

**Rationale**: Current clients independently map Axios and HTTP failures and the API can expose raw
exception messages. A registry makes service mapping, client behavior, localization, security
redaction, and tests agree.

**Alternatives considered**:

- HTTP status only: rejected because admin MFA, stale permissions, session expiry, and contract
  mismatch require distinct outcomes.
- Free-form codes per module: rejected because meanings and retry behavior would drift.
- Localized API messages only: rejected because clients must choose Arabic or English and should
  not depend on unstable prose.

## 8. Client Parsing and Retry Policy

**Decision**: Keep separate Axios adapters for driver and admin realms, but share platform-neutral
schema parsing and normalized error types. Safe reads retry at most twice for network failures,
408, 429, 502, 503, and 504, with exponential backoff and `Retry-After`. Writes retry only when the
operation declares idempotency.

**Rationale**: Authentication refresh and session outcomes differ between applications, so a
shared Axios singleton would couple security realms. TanStack Query supports bounded retry
functions and backoff. A shared classification function prevents contradictory behavior without
sharing application state.

**Alternatives considered**:

- One shared Axios client: rejected because driver and admin credentials, stores, redirects, and
  refresh semantics must remain isolated.
- Default retries for all errors: rejected because validation, authorization, deterministic
  conflict, and version mismatch cannot succeed without changed input or state.
- No retries: rejected because safe reads should tolerate short network and service interruptions.

**Primary reference**:
[TanStack Query retries](https://tanstack.com/query/latest/docs/framework/react/guides/query-retries)

## 9. Idempotency Persistence

**Decision**: Add a generic `IdempotencyRecord` model scoped by realm, actor ID, operation ID, and
key. Canonically hash the validated request. Replay completed matching requests, conflict on a
changed hash, and return an in-progress conflict for concurrent duplicates. Default retention is
24 hours.

**Rationale**: Existing `clientMutationId` columns are globally unique per table, do not scope keys
by actor or operation, and cannot replay the original response. A generic ledger provides one
testable behavior for migrated writes without redesigning domain records.

**Alternatives considered**:

- Keep per-table unique fields: rejected because behavior and scope differ by domain and original
  results cannot be replayed.
- In-memory cache: rejected because it fails across restarts and multiple API instances.
- Store all responses indefinitely: rejected because replay data may contain personal or
  operational data and would grow without bound.
- Apply generic storage to authentication tokens: rejected because credentials and token material
  must not be stored in replay payloads.

## 10. Dependency and Bundle Enforcement

**Decision**: Use reusable ESLint `no-restricted-imports` rules for fast local feedback and
dependency-cruiser for full graph checks, cycles, aliases, dynamic imports, transitive boundaries,
and undeclared dependencies. Keep artifact isolation as a separate production-build scan.

**Rationale**: ESLint alone does not prove transitive graph or emitted artifact isolation.
Dependency-cruiser supports custom forbidden rules and circular dependency checks, while the
existing verification framework can test controlled failure fixtures and inspect build outputs.

**Alternatives considered**:

- ESLint only: rejected because transitive cycles and some dynamic/alias paths would remain
  unverified.
- Dependency-cruiser only: rejected because developers need immediate editor feedback on direct
  forbidden imports.
- Bundle scan only: rejected because it detects problems late and does not explain the source
  dependency path.

**Primary reference**:
[dependency-cruiser rules and cycle checks](https://github.com/sverweij/dependency-cruiser)

## 11. Migration and Release Strategy

**Decision**: Migrate internally in dependency order but release API, driver web, and admin web as
one coordinated cutover. Keep the new database table additive and backward compatible through the
rollback window. After cutover, additive response changes within contract major version 1 may be
deployed independently.

**Rationale**: The clarification explicitly selected coordinated deployment and rejected a
temporary legacy response compatibility layer. Internal sequencing still reduces implementation
risk and permits contract tests before the final cutover.

**Alternatives considered**:

- Dual legacy/new envelopes: rejected by the clarification and would double boundary complexity.
- Versioned parallel endpoints for every operation: rejected because Phase 1 is a repository-wide
  normalization rather than a public multi-generation API product.
- Client-first incompatible release: rejected because clients would fail against the current API.

## 12. Verification Scope

**Decision**: Catalog coverage is 100% for active operations and active consumers. Deep agreement
tests sample at least five driver and five admin domains, while core envelope, error, pagination,
version, units, and security schemas receive exhaustive unit and mutation tests.

**Rationale**: The repository has 161 discovered routes, so every operation must be inventoried,
but duplicating full end-to-end tests for every route would add low-value repetition. Generated
coverage checks plus representative behavioral suites provide breadth and depth.

**Alternatives considered**:

- Representative catalog only: rejected because undocumented active operations would remain.
- Full E2E for all 161 routes in Phase 1: rejected because Phase 1 changes contracts rather than
  product journeys and would exceed the phase boundary.
- Compile-only checks: rejected because runtime payloads, unknown keys, and compatibility behavior
  require executable tests.
