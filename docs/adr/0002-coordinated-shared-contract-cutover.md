# ADR-0002: Coordinated Shared Contract Cutover

**Status**: accepted
**Date**: 2026-06-07
**Owner**: Platform team

## Context

The Ehsbha platform has grown to include three separate applications (API, driver web, admin web) that communicate via HTTP. Each application previously maintained its own local request/response type definitions, leading to:

- Divergent validation rules between producer and consumers
- Manual synchronization burden when contracts change
- No mechanical way to detect breaking changes before deployment
- Inconsistent error codes and response envelopes across domains

Feature 002 introduces shared TypeScript packages (`@ehsbha/shared-types`, `@ehsbha/api-contracts`) that define Zod schemas as the single source of truth for all API contracts. The question is how to cut over from local definitions to shared ones without breaking existing behavior.

## Decision

We will perform a **coordinated single-release cutover** where all three applications (API, driver web, admin web) are deployed simultaneously with the shared contract changes.

### Key design choices:

1. **Zod schemas as source of truth**: Shared contracts use Zod `.strict()` for requests (reject unknown fields) and `.passthrough()` for responses (preserve unknown fields).

2. **Response envelope standardization**: All API responses use `{ data, meta: { requestId, serverTime, apiVersion, contractVersion } }` format. Error responses use `{ error: { code, message, messageKey }, meta }`.

3. **Governed error registry**: 17 standardized error codes with fixed HTTP status mappings. Unknown codes normalize to `CONTRACT_VIOLATION` (502).

4. **Passthrough response validation**: Response schemas use `.passthrough()` to preserve backward compatibility with future field additions.

5. **No staged rollout**: Because the response envelope format changes globally, a staged rollout would require maintaining both old and new formats. The coordinated cutover is simpler and less error-prone.

## Consequences

### Positive:
- Single source of truth eliminates contract drift
- Mechanical boundary enforcement catches violations at build time
- Shared error catalog enables consistent client error handling
- Zod schemas serve as both runtime validation and TypeScript types

### Negative:
- All three applications must deploy simultaneously
- Rollback requires coordinated revert of all three applications
- Any contract change requires updating the shared package, API, and both clients

### Mitigations:
- Feature branch (`feature/002-shared-platform-contracts`) isolates all changes
- Verification scripts (`verify:contracts`, `verify:boundaries`, `verify:frontend-isolation`) run in CI
- Contract compatibility classification prevents accidental breaking changes in major version 1
- Rollback procedure documented in `docs/contracts/coordinated-release-runbook.md`

## Alternatives

### Staged rollout with legacy envelope support
- Would require maintaining both old and new response formats
- Increases complexity and risk of inconsistencies
- Rejected because the envelope format change is global and cannot be versioned per-endpoint

### Per-endpoint migration
- Would allow gradual rollout but requires maintaining compatibility shims
- Significantly increases implementation complexity
- Rejected because the shared contract package must be the single source of truth

## Rollback Model

1. Revert the feature branch merge commit
2. Redeploy all three applications from the previous commit
3. Verify no shared contract imports remain in application code
4. Run full verification suite to confirm clean state
