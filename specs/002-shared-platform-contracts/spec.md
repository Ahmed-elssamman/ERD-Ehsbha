# Feature Specification: Shared Platform Foundation and API Contracts

**Feature Branch**: `002-shared-platform-contracts`

**Created**: 2026-06-09

**Status**: Draft

**Input**: User description: "Read plan.md and create a specification for Phase 1 - Shared Platform Foundation and API Contracts only."

## Clarifications

### Session 2026-06-11

- Q: How should shared contracts handle unknown fields in requests and responses? → A: Reject unknown request fields; ignore unknown response fields.
- Q: How should the initial shared-contract migration be deployed? → A: Require one coordinated API, web, and admin deployment.
- Q: What are the platform-wide pagination bounds? → A: Default 25 items; maximum 100 items.
- Q: How should a client handle a contract-version mismatch? → A: Reject the response with a contract-version mismatch error.
- Q: What outcome should a duplicate idempotency key produce? → A: Same key and payload returns the original result; changed payload returns conflict.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consume One Authoritative Contract (Priority: P1)

As a contributor working on the service, driver application, or administration application, I
need each active request and response shape to have one authoritative definition so that a change
cannot silently leave another application using an incompatible interpretation.

**Why this priority**: Contract drift between independently deployed applications can cause
runtime failures even when every application compiles and builds independently.

**Independent Test**: Select representative active operations from driver authentication,
profiles, trips, OCR, and administration. Verify that valid requests and responses are accepted by
the shared definitions, malformed payloads are rejected consistently, and every active consumer
uses the same definitions rather than a local duplicate.

**Acceptance Scenarios**:

1. **Given** an active operation used by one or more applications, **When** its request, success
   response, or failure response is inspected, **Then** one authoritative contract defines the
   payload and all consumers derive their interpretation from it.
2. **Given** a response that omits a required field, contains an invalid unit, or has an
   incompatible field type, **When** a consumer receives it, **Then** the response is rejected as
   a contract violation rather than trusted or partially interpreted.
3. **Given** a contract is changed incompatibly, **When** repository verification runs, **Then**
   the affected service and application consumers fail verification until compatibility is
   restored or an approved version transition is defined.
4. **Given** an active contract has multiple current consumers, **When** the contract changes,
   **Then** all affected consumers and representative contract tests are updated in the same
   delivery.

---

### User Story 2 - Receive Consistent Platform Responses and Errors (Priority: P1)

As a driver, administrator, or support operator, I need all platform operations to communicate
success, failure, pagination, dates, and numeric units consistently so that applications can
provide predictable behavior and useful recovery guidance.

**Why this priority**: Inconsistent response and error formats force each client to guess how an
operation failed, which produces incorrect messages, retry behavior, and state handling.

**Independent Test**: Exercise representative successful, validation, authentication,
authorization, not-found, conflict, throttling, and unexpected-failure cases across multiple
domains. Confirm that each result follows the same envelope, metadata, error-code, and request
trace conventions.

**Acceptance Scenarios**:

1. **Given** a successful operation, **When** a client receives the result, **Then** it can
   distinguish the operation data from shared metadata using one platform-wide format.
2. **Given** a validation or business-rule failure, **When** a client receives the result, **Then**
   it receives a stable machine-readable code, a safe user-facing message or message key,
   field-level details when applicable, and a request identifier.
3. **Given** an unexpected internal or provider failure, **When** it crosses the service boundary,
   **Then** implementation details, stack traces, credentials, and private provider messages are
   absent while the request remains traceable by authorized operators.
4. **Given** a list operation, **When** its result spans more than one page, **Then** the client
   receives bounded, unambiguous continuation or offset metadata and cannot request an
   unbounded page.
5. **Given** a response contains money, distance, duration, or a timestamp, **When** any consumer
   interprets it, **Then** the unit and time convention are unambiguous and identical across all
   applications.

---

### User Story 3 - Use Predictable Client Data Behavior (Priority: P2)

As a driver or administrator, I need screens to handle loading, successful data, expected
failures, expired access, forbidden access, and transient service problems consistently so that
the same condition does not produce contradictory behavior across the platform.

**Why this priority**: Shared contracts deliver limited value if applications still unwrap
responses, classify errors, retry operations, and refresh data differently.

**Independent Test**: Use representative driver and administration reads and writes to verify
consistent response parsing, error normalization, retry decisions, data refresh behavior, and
session-related outcomes.

**Acceptance Scenarios**:

1. **Given** a valid successful response, **When** a driver or administration client processes it,
   **Then** the contract is validated and the application receives the operation data in a
   consistent form.
2. **Given** a validation, authentication, authorization, or conflict failure, **When** a client
   processes it, **Then** it does not retry automatically and exposes the correct normalized
   outcome to the calling feature.
3. **Given** a transient failure on a safe read, **When** retry conditions are met, **Then** retry
   behavior is bounded and consistent across applications.
4. **Given** a successful write, **When** related displayed data becomes stale, **Then** the
   affected domain data is refreshed or updated according to a documented rule.
5. **Given** an administration response indicates forbidden access, stale permissions,
   additional verification required, or an expired session, **When** the client processes it,
   **Then** each condition produces a distinct and consistent application outcome.
6. **Given** a retryable write could be submitted more than once, **When** the operation is
   retried, **Then** the client and service use a stable operation identifier where duplicate
   effects would be harmful.

---

### User Story 4 - Enforce Application and Package Boundaries (Priority: P2)

As an architecture owner, I need invalid dependencies to be rejected automatically so that the
driver application, administration application, service, and shared packages remain independently
deployable and do not expose server-only code or one application's internals to another.

**Why this priority**: Documented boundaries are insufficient when accidental imports can compile,
enter production bundles, or create dependency cycles.

**Independent Test**: Introduce controlled forbidden imports and dependency cycles and confirm
that verification rejects each violation with a clear boundary rule, while valid shared-package
imports continue to pass.

**Acceptance Scenarios**:

1. **Given** driver application code imports administration application source, or the reverse,
   **When** verification runs, **Then** the change is rejected.
2. **Given** frontend code imports persistence, service-framework, server configuration, secrets,
   or another backend-only module, **When** verification runs, **Then** the change is rejected.
3. **Given** shared packages form a dependency cycle, **When** verification runs, **Then** the
   responsible dependency path is reported and acceptance is blocked.
4. **Given** either frontend is built for production, **When** its artifact is inspected, **Then**
   source or identifiable application code from the other frontend is absent.
5. **Given** a shared package is consumed, **When** it is loaded or tested, **Then** it has no
   application startup side effects and does not require browser-only or server-only state unless
   that package is explicitly limited to that environment.

---

### User Story 5 - Evolve Contracts Without Hidden Breakage (Priority: P3)

As a release owner, I need contract identity and compatibility expectations to be visible so that
the service and independently deployed clients can be released in a safe order.

**Why this priority**: Shared definitions prevent many mistakes, but release safety also requires
recognizing incompatible changes and knowing which consumers support each contract generation.

**Independent Test**: Review and simulate a compatible additive change and an incompatible change.
Confirm that consumers can identify the contract generation, additive changes preserve existing
behavior, and incompatible changes require an explicit transition plan.

**Acceptance Scenarios**:

1. **Given** a client receives a service response, **When** it inspects shared metadata, **Then**
   it can identify the service API version, contract version, and request identifier.
2. **Given** a backward-compatible optional field is added, **When** older supported consumers
   receive the response, **Then** their documented behavior remains valid.
3. **Given** a required field, meaning, unit, error code, or pagination rule changes
   incompatibly, **When** the change is proposed, **Then** it includes a compatibility window,
   migration expectations, affected consumers, and release ordering before acceptance.

### Edge Cases

- A response has a successful transport status but fails its success contract.
- A failure response contains an unknown error code or malformed field details.
- A list contains no items but still has valid pagination metadata.
- A page-size request is zero, negative, non-numeric, or above the platform maximum.
- A cursor is expired, malformed, or belongs to a different filter or sort order.
- A timestamp lacks an offset, uses local time, or cannot be parsed unambiguously.
- A monetary value contains a fraction of the smallest supported unit or exceeds its safe range.
- An identifier from one domain or security realm is supplied where another identifier is
  expected.
- A response includes additional fields during a compatibility window.
- A client and service report incompatible contract versions; the client rejects the response
  without processing its operation data and surfaces a normalized contract-version mismatch.
- A write is retried after the first attempt succeeded but the response was lost; the same
  idempotency key and payload return the original result without another business effect.
- An idempotency key is reused with a different payload; the service returns a conflict and does
  not execute the changed operation.
- A shared contract accidentally imports application-specific, persistence, browser, or
  service-framework behavior.
- An alias, dynamic import, generated file, or transitive dependency bypasses a simple source
  path rule.
- A contract describes a currently scaffold-only or inactive endpoint as active production
  behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The platform MUST provide one authoritative contract catalog for every active
  request, success response, failure response, and shared event consumed by the service, driver
  application, or administration application.
- **FR-002**: The initial catalog MUST cover shared envelopes and pagination plus the active
  operations in authentication, user and driver profiles, vehicles, app sources, areas, trips,
  OCR, operating costs, sessions, goals, analytics, recommendations, score, forecast, community,
  reviews, support, notifications, and current administration operations.
- **FR-003**: Each catalog entry MUST identify its operation, direction, required and optional
  fields, validation rules, units, compatibility expectations, and consuming applications.
- **FR-004**: All active consumers MUST use types derived from the authoritative contracts and
  MUST NOT maintain competing local endpoint interfaces for migrated operations.
- **FR-005**: Clients MUST validate untrusted service responses before using them as application
  data.
- **FR-006**: The service MUST validate external request data according to the same authoritative
  request rules used by consumers.
- **FR-007**: The platform MUST use one success-envelope convention that separates operation data
  from shared metadata.
- **FR-008**: The platform MUST use one failure-envelope convention containing a stable
  machine-readable error code, safe message information, request identifier, and optional
  field-level details.
- **FR-009**: The platform MUST define a governed error-code catalog with a single meaning and
  expected outcome category for each code.
- **FR-010**: Validation, authentication, authorization, not-found, conflict, throttling, and
  unexpected failures MUST map consistently to their documented outcome categories.
- **FR-011**: Every service response and corresponding diagnostic record MUST carry the same
  request identifier.
- **FR-012**: Service responses MUST identify the active API version and contract version in a
  consistent location.
- **FR-012A**: When a response reports an unsupported contract version, the client MUST reject
  the response without processing its operation data, preserve the request identifier for
  diagnosis, and surface a normalized contract-version mismatch outcome.
- **FR-013**: The platform MUST define bounded cursor and offset pagination conventions,
  including a default page size of 25 items, a maximum page size of 100 items, continuation
  behavior, empty results, sorting, and invalid-page handling.
- **FR-014**: Platform-wide values MUST represent money as integer minor units, distance in
  meters, duration in seconds, and instants as unambiguous UTC timestamps.
- **FR-015**: Shared identifiers and common value types MUST prevent accidental substitution of
  materially different domains or units where such substitution creates correctness risk.
- **FR-016**: Common locale, timezone, status, and platform enumerations MUST have one
  authoritative definition when they are exchanged across application boundaries.
- **FR-017**: The driver and administration applications MUST each provide one consistent
  mechanism for validating and unwrapping success responses and normalizing failure responses.
- **FR-018**: Client retry rules MUST prohibit automatic retries for validation, authentication,
  authorization, deterministic conflict failures, and contract-version mismatches.
- **FR-019**: Automatic retry of safe reads MUST be bounded and limited to documented transient
  conditions.
- **FR-020**: Retryable writes whose duplication could create incorrect state MUST support a
  stable idempotency identifier. Repeating the same identifier with the same payload MUST return
  the original result without another business effect; reusing it with a different payload MUST
  return a conflict without executing the changed operation.
- **FR-021**: Each active client domain MUST define stable data lookup identities and document
  which related data is refreshed or updated after a successful mutation.
- **FR-022**: Administration clients MUST distinguish forbidden access, stale permission state,
  additional-verification requirements, and expired sessions.
- **FR-023**: Administration list operations MUST share a common query convention for search,
  sorting, filtering, pagination, and export eligibility.
- **FR-024**: Administration mutations that require an operational reason MUST share reason and
  reason-code conventions without making the reason visible to unauthorized users.
- **FR-025**: Verification MUST reject source dependencies between the driver and administration
  applications in either direction.
- **FR-026**: Verification MUST reject frontend dependencies on persistence code, service-only
  frameworks, server configuration, secrets, and backend-only modules.
- **FR-027**: Verification MUST reject dependency cycles among applications and shared packages
  and report the dependency path responsible for the cycle.
- **FR-028**: Production artifact verification MUST confirm that each frontend excludes the other
  frontend's source and identifiable application-specific modules.
- **FR-029**: Shared packages MUST be independently verifiable, free of application startup side
  effects, and limited to their documented platform-neutral responsibility.
- **FR-030**: Shared visual foundations MUST be limited to reusable design values and MUST NOT
  contain driver or administration pages, layouts, navigation, authentication state, or domain
  workflows.
- **FR-031**: Representative contract tests MUST prove valid and invalid request, success,
  failure, pagination, unit, date, and compatibility behavior.
- **FR-032**: The active service description used by contributors and integrators MUST be checked
  against the authoritative contract catalog so that undocumented or mismatched operations block
  acceptance.
- **FR-033**: An incompatible contract change MUST identify affected consumers, migration
  behavior, compatibility window, and release order before it can be accepted.
- **FR-034**: Phase 1 MUST migrate all active API clients to shared contracts; scaffold-only,
  obsolete, or demonstrably inactive operations MAY be excluded only when they are clearly
  inventoried with an owner and follow-up.
- **FR-035**: Phase 1 MUST NOT redesign authentication flows, replace security realms, add new
  domain capabilities, complete scaffold administration workflows, implement offline
  synchronization, or introduce billing behavior.
- **FR-036**: The initial Phase 1 contract migration MUST be released as one coordinated API,
  driver application, and administration application deployment. The migration MUST NOT rely on
  temporary legacy response compatibility between those deployment units.

### Contract and Data Requirements

- **CR-001**: Every request contract MUST state accepted fields, required fields, value
  constraints, and whether repeated submission requires idempotency. All unknown request fields
  MUST be rejected. Idempotent requests MUST define how payload equivalence is determined.
- **CR-002**: Every success contract MUST state operation data, shared metadata, units, timestamps,
  and nullability. Consumers MUST ignore unknown response fields so additive response changes
  remain compatible.
- **CR-003**: Every failure contract MUST state stable error code, safe message behavior,
  field-level details when relevant, request identity, and whether retry is allowed.
- **CR-004**: Pagination contracts MUST state mode, use the platform default of 25 items and
  maximum of 100 items unless an approved exception is documented, and define stable ordering,
  continuation or offset metadata, filter/sort binding, and empty-page behavior.
- **CR-005**: Shared value contracts MUST define integer minor-unit money, meters, seconds,
  identifiers, locale, timezone, and common enumerations without application-specific behavior.
- **CR-006**: Contract identity MUST distinguish API version from contract version and define how
  supported consumers react to a mismatch. Unsupported versions MUST produce a normalized
  contract-version mismatch error rather than warning and continuing.
- **CR-007**: The contract catalog MUST identify every active service, driver, and administration
  consumer and provide a migration status for any former local duplicate.
- **CR-008**: Contract changes MUST classify compatibility impact as additive-compatible,
  behaviorally changed, or incompatible.
- **CR-009**: Existing persisted records are not redesigned by Phase 1. If contract normalization
  exposes a persisted-data incompatibility, it MUST be documented for a later domain phase unless
  a narrowly scoped correction is required to preserve current behavior.
- **CR-010**: No shared public contract may expose persistence records, internal provider
  payloads, credentials, stack traces, or private operational fields by default.

### Security and Privacy Requirements

- **SR-001**: Driver and administration contract identities, credentials, claims, errors, and
  client state MUST remain separate security realms.
- **SR-002**: Shared contracts MUST not weaken existing authorization or ownership rules; a valid
  payload is not proof of permission to perform the operation.
- **SR-003**: Failure contracts MUST not expose secrets, tokens, credentials, private provider
  messages, stack traces, database details, or personal data beyond the authorized operation.
- **SR-004**: Unknown or malformed external input MUST be rejected before it reaches domain or
  persistence behavior.
- **SR-005**: Sensitive mutations MUST reject unknown fields when accepting them could enable
  mass assignment or privilege changes.
- **SR-006**: Shared idempotency identifiers MUST be scoped so that one actor or security realm
  cannot observe or replay another actor's operation.
- **SR-007**: Request identifiers MUST support diagnosis without embedding credentials or
  personal information.
- **SR-008**: Boundary verification MUST account for direct, aliased, dynamic, and transitive
  imports that could expose server-only or cross-application code.
- **SR-009**: Representative security tests MUST cover malformed payloads, unknown fields,
  realm-confused identifiers, unsafe error details, forbidden imports, and duplicate write
  attempts.

### Non-Functional Requirements

- **NFR-001**: Contract validation and envelope handling MUST not cause representative service
  operations or application interactions to exceed the existing platform latency and bundle
  budgets.
- **NFR-002**: A contract or boundary failure MUST identify the affected operation, consumer, or
  dependency path without requiring a full production-like run to locate the cause.
- **NFR-003**: Shared contracts and value definitions MUST be understandable from maintained
  documentation and examples without reading application-specific implementation.
- **NFR-004**: Contract and boundary verification MUST be deterministic, isolated from production
  services, and produce the same pass/fail result for the same revision and environment.
- **NFR-005**: Shared definitions MUST support Arabic and English message selection, valid locale
  and timezone exchange, and both right-to-left and left-to-right consumers without embedding
  presentation behavior.
- **NFR-006**: Existing driver, administration, and service deployment units MUST remain
  independently buildable and deployable.
- **NFR-007**: After the coordinated Phase 1 migration, compatible additive contract changes MUST
  support independent deployment order during their documented compatibility window.
- **NFR-008**: Incompatible contract changes MUST be blocked until coordinated rollout and
  recovery expectations are documented and verified.
- **NFR-009**: Shared packages MUST remain small enough that adopting them does not cause either
  frontend to exceed its approved artifact budgets.
- **NFR-010**: Phase 1 changes MUST preserve current user-visible behavior unless normalization is
  required to remove an existing contract inconsistency; any visible correction MUST be
  documented with regression evidence.

### Key Entities

- **Contract Definition**: The authoritative description of an operation's request, success,
  failure, metadata, validation, units, and compatibility behavior.
- **Contract Catalog Entry**: The inventory record connecting a contract definition to its
  operation, lifecycle status, version, and service, driver, or administration consumers.
- **Success Envelope**: The platform-wide container for operation data and shared response
  metadata.
- **Failure Envelope**: The platform-wide container for stable error information, safe details,
  and request identity.
- **Error Code**: A stable machine-readable failure identifier with one governed meaning and
  expected client outcome.
- **Pagination Descriptor**: The shared rules and metadata for bounded cursor or offset list
  navigation.
- **Shared Value Type**: A platform-neutral value with explicit meaning or unit, such as minor-unit
  money, meters, seconds, identifiers, locale, or timezone.
- **Request Identity**: A privacy-safe identifier connecting a client response with authorized
  diagnostic evidence.
- **Contract Version**: The compatibility identity of the shared contract catalog, distinct from
  the public service API version.
- **Boundary Rule**: A mechanically verifiable rule governing permitted dependencies among
  applications, shared packages, and server-only code.
- **Client Data Rule**: A documented rule for response parsing, error normalization, retries,
  lookup identities, mutation refresh, and duplicate prevention.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of active service operations used by the driver or administration application
  appear in the contract catalog with request, success, failure, consumer, unit, and compatibility
  information, measured by repository inventory against active client calls and service routes.
- **SC-002**: 100% of active driver and administration API clients use authoritative shared
  contracts with zero competing local endpoint response definitions, measured by automated source
  and contract-consumer verification.
- **SC-003**: Representative valid and invalid payload suites achieve 100% agreement between
  service-side and client-side contract decisions for required fields, value constraints, units,
  dates, envelopes, errors, and pagination.
- **SC-004**: Controlled incompatible changes to each representative contract category are
  rejected in 100% of tests before acceptance, with the affected consumer or operation named in
  the failure.
- **SC-005**: 100% of sampled success and failure responses across at least five driver domains
  and five administration domains follow the shared envelope, request identity, version, error,
  date, unit, and pagination rules.
- **SC-006**: Controlled forbidden imports for every declared boundary category are rejected in
  100% of tests, and valid shared-package imports continue to pass.
- **SC-007**: Dependency-cycle checks report and reject 100% of representative direct and
  transitive cycles introduced in isolated test fixtures.
- **SC-008**: Production artifact inspection finds zero driver-application modules in the
  administration artifact and zero administration-application modules in the driver artifact.
- **SC-009**: Representative safe reads never retry validation, authentication, authorization, or
  deterministic conflict failures and never exceed the documented transient retry limit,
  measured by client behavior tests.
- **SC-010**: Representative retryable writes produce one business effect under duplicate
  submission in 100% of idempotency tests.
- **SC-011**: Contract and boundary verification completes within the existing repository
  verification budget and does not increase either frontend's compressed initial artifact or
  route artifacts beyond approved limits without a documented exception.
- **SC-012**: A contributor unfamiliar with the migration can locate an operation's authoritative
  request, response, error, version, and consumer information within 10 minutes using maintained
  documentation, measured by a recorded walkthrough.
- **SC-013**: Zero secrets, credentials, internal provider payloads, persistence records, or stack
  traces appear in representative shared contracts, failure responses, client-normalized errors,
  or retained verification evidence.
- **SC-014**: All existing active user journeys retain their pre-Phase 1 observable outcome unless
  an inconsistency is explicitly corrected and covered by approved regression evidence.

## Assumptions

- Phase 0 provides a trustworthy enough baseline, route and endpoint inventory, and verification
  entry point for Phase 1 work; unresolved Phase 0 blockers must be corrected before Phase 1 can
  claim completion.
- The current service operations and active driver and administration clients are the migration
  source of truth. Phase 1 normalizes their contracts but does not add new product capabilities.
- Existing authentication and authorization mechanisms remain in place until Phase 2; Phase 1
  only standardizes their exchanged payloads and outcomes.
- Existing persisted data remains authoritative. Broad schema redesign and migrations belong to
  later domain phases unless a narrow compatibility correction is unavoidable.
- Both cursor and offset pagination may remain supported where current product needs differ, but
  each operation must select and document one mode consistently.
- Existing API versioning remains in place while contract version identity is added as separate
  compatibility metadata.
- The initial Phase 1 migration uses a coordinated API, driver application, and administration
  application deployment rather than a staged legacy-response compatibility window.
- After that migration, additive optional response fields are backward-compatible when existing
  consumers ignore them safely; changed meanings, units, required fields, or error semantics are
  incompatible.
- Shared visual values are in scope only to establish application-neutral tokens. Shared pages,
  layouts, navigation, authentication state, and domain workflows are out of scope.
- OpenAPI or equivalent service documentation is an output of the authoritative contracts, not a
  second manually maintained source of truth.
- Offline synchronization, advanced observability, identity hardening, new administration
  workflows, billing, and deployment automation remain assigned to later phases.
