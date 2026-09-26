# ADR-0011: Recoverable manual trips and versioned corrections

**Status**: accepted
**Date**: 2026-09-17
**Owner**: Platform team

## Context

Manual trip inputs and their create identity lived only in the mounted editor.
The existing driver write lock protected aggregate transactions but allowed an
older full form to overwrite a newer correction. OCR confirmation receipts
protected import replay; they did not record subsequent financial corrections.

## Decision

Extend the account-scoped IndexedDB draft protocol from ADR-0010 to manual trip
creation and editing. Store incomplete inputs separately from validated request
data, retain the reviewed trip and version, and persist the submission body and
identity before HTTP. Pending submissions freeze inputs and derived-value
effects. Replaying uses the same body and identity after reload. Keep a returned
trip ID in the mounted editor while successful-save cleanup retries, then
navigate only after local completion. A list of draft metadata permits recovery
outside the current server page and date filter. Inline storage failures leave
the screenshot capture action accessible.

Add positive trip versions. Driver corrections, deletion and restoration and
admin bulk deletion/restoration require the versions reviewed by their callers.
Check them under existing driver locks and commit source changes, versioned
financial snapshots, aggregate projections and applicable admin audit records
together. Admin batches reject all changes if any target is stale. Driver batch
deletion retains its per-item result semantics. Retry fingerprints include the
resource path and, for deletion, the expected-version query parameter.

Record server-controlled creation origin: manual, OCR or sync. Historical rows
remain unconfirmed unless a retained OCR confirmation proves their origin.
Do not manufacture historical revisions. Financial history excludes notes and
pickup/destination text, while recording the actor realm and before/after facts.
Admin audit records separately retain the responsible administrator.

Expose deleted trips, restoration and paged correction history to the owning
driver. Trip listing uses a scoped cursor over descending start time and ID;
history uses descending version. These are incompatible changes to existing
trip contracts in the unpublished coordinated major-2 release. Update the API,
driver app, admin app, catalog and release manifest together.

## Alternatives

Keeping only the driver lock would still accept an outdated full form. Reusing
OCR confirmation receipts would conflate import acknowledgement with later
corrections. Automatically replacing a draft's version with the current one
would bypass the driver's review. Retain the existing locks, add explicit
versions and share the established draft protocol instead.

## Consequences

An outdated form cannot silently become a fresh correction. The driver reviews
the current trip and deliberately discards or retains the old draft. Financial
history and record versions remain authoritative after the HTTP replay ledger
expires. A pending correction beyond that window may require manual review;
it cannot overwrite a newer version. Browser storage still has the device and
account limitations documented in ADR-0010. Status confirmation dialogs retain
their reviewed target and retry key while mounted; they are not durable drafts.

The current React/Nest architecture and existing financial evidence rules are
preserved. No framework migration, production database operation or deployment
is part of this decision.

## Verification

Real PostgreSQL checks cover version races, ownership, source origin, source and
revision rollback, tied-time pagination, scoped cursors, deletion/restoration,
existing OCR receipt replay and linked-cost aggregate reconciliation. Browser
acceptance checks exercise incomplete drafts, lost responses, stale corrections,
delete fingerprinting, restoration and Arabic mobile history. The associated
checkpoint records executed evidence and remaining work.
