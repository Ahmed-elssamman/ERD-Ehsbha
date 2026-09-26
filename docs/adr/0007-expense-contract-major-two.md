# ADR-0007: Expense contract major 2

**Status**: accepted
**Date**: 2026-09-17
**Owner**: Platform team

## Context

Expense list responses now contain a bounded page instead of an array. Edits,
deletion and restoration require an expected version; expense writes require
idempotency keys. Driver expense responses carry required link, deletion and
version fields. Hour comparisons now subtract recorded tolls and parking.
These changes cannot honestly be classified as additive in contract major 1.

## Decision

Advance the shared semantic contract version to 2.0.0 and support major 2 in
both browser clients. Keep the HTTP route namespace `/api/v1`; the semantic
contract header/envelope version and the route namespace are separate values.
Publish the exact breaking operation set in the shared release manifest.
Compatibility checks require that set to match the registry, require a major
advance over the previous release, and reject undeclared breaking operations.

Deploy API, driver web and admin web together. Refresh installed PWA/browser
assets as part of the coordinated cutover. Older clients are unsupported;
their response parser rejects major 2, and new clients reject major 1. Version
mismatch remains a distinct non-retryable error. This is version detection,
not a second authorization mechanism. Existing source ownership controls and
required expense versions remain enforced by the API.

## Consequences

Clients cannot silently interpret the new expense page as the old array or
overwrite expense edits without supplying a version. Contract tests retain
explicit rejection coverage for prior and future majors. Successful unrelated
operations keep their existing request/response behavior within major 2.

The cutover is coordinated, not a claim of support for concurrently deployed
major-1 clients. Preserve persisted financial data and use a compatible rollback
build; old writers do not understand links or archived expenses. The detailed
release and backup constraints are in `docs/product/expense-integrity.md`.

The release remains unpublished in this workspace. ADR-0008 extends the same
coordinated major-2 manifest for recorded maintenance costs and service history;
the release manifest is the authoritative complete breaking-operation list.

## Alternatives

Relabeling the breaking operations as additive would defeat the compatibility
gate. Maintaining two expense writer APIs would permit legacy writes without
the new integrity checks and add migration complexity. Neither is adopted.
