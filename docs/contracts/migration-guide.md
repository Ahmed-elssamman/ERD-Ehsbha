# Contract Migration Guide

## Adding a New Contract

1. Define the Zod schema in the appropriate domain file
2. Register the operation in the same file
3. Add tests for the new schema
4. Run `npm run contracts:generate` to verify

## Adding a New Operation

1. Define the operation entry in the appropriate domain file under `packages/api-contracts/src/domains/`
2. Choose a unique `operationId` in the format `<realm>.<domain>.<action>` (e.g. `driver.trips.list`)
3. Declare the HTTP method, path, realm, and lifecycle status
4. Reference request schema names and a success data schema
5. List failure codes from the governed error registry
6. Add consumer bindings with application name, role, migration status, and owner
7. Set compatibility classification to `additive-compatible`
8. Register the operation using `registerOperation()` from the catalog registry
9. Add domain spec tests exercising the new operation
10. Run `npm run packages:build` and `npm run contracts:generate`
11. Verify the operation appears in the generated catalog

### operationId Convention

```
<realm>.<domain>.<action>
```

Examples: `driver.auth.login`, `admin.users.list`, `public.health.check`

- Must match the pattern `^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*){2,}$`
- Must be unique across the entire catalog
- Must not change after the operation is active

## Changing an Existing Operation

### Additive Changes (Compatible)

- Add optional fields to response schemas
- Add new enum values (if client handles unknown)
- No migration plan or version bump required

### Behavioral Changes

- Change field semantics while keeping wire format
- Update the compatibility classification to `behaviorally-changed`
- Document the behavioral change in the operation entry
- Consumer migration plan required
- All consumers must acknowledge the change before deployment

### Incompatible Changes

> **Not permitted in contract major version 1.**

- Remove or rename fields
- Change field types
- Make optional fields required
- Change pagination semantics
- Rename or remove an operation

Incompatible changes require a new contract major version and a coordinated
transition plan. See [Compatibility Rules for Major Version 1](#compatibility-rules-for-major-version-1).

## Compatibility Rules for Major Version 1

### Active Operations

All active operations in contract major version 1 must remain `additive-compatible`.
This means:

- Response schemas must use passthrough object behavior (clients tolerate unknown fields)
- Request schemas must use strict object behavior (API rejects unknown fields)
- Only optional fields may be added to response schemas
- New enum values may be added only when clients handle unknown values gracefully
- No fields may be removed, renamed, or changed in type
- No optional field may become required
- No pagination semantics may change
- No operation may be removed without a deprecation process

### Enforcement

- The compatibility classification is verified by `scripts/verification/tests/contract-compatibility.test.mjs`
- Active operations classified as `behaviorally-changed` or `incompatible` in major version 1
  will cause verification to fail
- The catalog generation process rejects incompatible entries without an approved transition

### Timeline

- Major version 1 supports only additive-compatible changes
- A future major version 2 may introduce incompatible changes after a deprecation period
- All consumers must migrate to the new major version before the old one is removed

## How to Deprecate an Operation

1. Change the operation lifecycle from `active` to `obsolete`
2. Set the `followUp` field to reference the replacement operation or migration plan
3. Update the compatibility classification to reflect the last compatible state
4. Notify all listed consumers of the deprecation timeline
5. Keep the operation functional until all consumers have migrated away
6. After the deprecation window closes and no consumers remain, change lifecycle to `inactive`
7. Remove the operation implementation in the next contract major version

### Deprecation Lifecycle

```text
active → obsolete → inactive → removed (next major version)
```

- `obsolete`: Operation still functions but new consumers should not depend on it.
  Replacement or migration path is documented in `followUp`.
- `inactive`: Operation is no longer maintained. Consumers must have migrated.
  Implementation may remain for backward compatibility during a transition window.
- Removed: Only permitted in a new contract major version.

## Migration Workflow

1. Update the schema in `packages/api-contracts`
2. Update the API adapter in `apps/api`
3. Update driver web client in `apps/web`
4. Update admin client in `apps/admin`
5. Run `npm run verify:contracts`
6. Deploy all artifacts together via the [coordinated release runbook](./coordinated-release-runbook.md)
