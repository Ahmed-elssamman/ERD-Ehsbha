# ADR-0008: Recorded maintenance costs and projection revision

**Status**: accepted
**Date**: 2026-09-17
**Owner**: Platform team

Subsequent ADR-0009 advances the financial projection version to 3 for fuel
archive/link semantics; this ADR records the earlier version-2 transition.

## Context

Recording a service cost previously left operating income unchanged. Daily
rebuilds instead retained and deducted a historical maintenance estimate.
Service records lacked retry protection, correction history and reversible
deletion. The same payment could also appear separately in expenses.

## Decision

Count active, unlinked service costs on their Cairo service date. Allow an
explicit link to one owned, active Other expense with the same positive amount
and a compatible vehicle. The expense supplies the payment date when active;
its deletion returns the cost to the active service record. Preserve both source
records and reject disagreement. Equal amounts alone never establish a link.
Zero-cost services remain valid and need no expense link.

Keep actual maintenance in `maintenancePiastres`. Preserve historical estimates
in `maintAmortPiastres` and expose them separately as retained estimates. Net
operating income deducts actual recorded fuel purchases, expenses and unlinked
service costs. It excludes estimated maintenance wear. Linked expense costs
remain in the expense category, so the maintenance subtotal explicitly means
service costs outside expenses.

Add driver financial projection version 2. Existing drivers begin at version 1;
new drivers begin at 2. Reuse the driver lock and atomic calendar rebuild to
replace every source/stale projection date and period before advancing the
version. Readers refuse cross-driver summaries until all drivers are ready.
The repair CLI reports pending versions and defaults to preview. Estimates are
retained; source history is not invented for older records.

All service writes check ownership, applicability, versions and links under the
driver lock. Source, projections, retained financial snapshots and recommendation
expiry commit together. Retry fingerprints bind vehicle, record and expected
version. History orders by version, not transaction-start timestamps, and excludes
free-text notes. Database constraints enforce owner links and active uniqueness.

The coordinated contract-major-2 release is still unpublished in this workspace.
Extend its exact breaking-operation manifest for paged maintenance responses,
required retry keys, missing-history status and consumers of changed operating
income. Do not label these changes additive or imply support for old writers.

## Consequences

Old source records are included in reporting only after an atomic rebuild. A
failure preserves the prior projection/version for repair, and no hybrid report
is returned. All API, driver and admin artifacts need the same coordinated
release. Rollback needs a compatible forward fix; old writers cannot safely
interpret archived or linked services. No production migration is run here.

Service date is the recorded cost date unless a linked expense supplies a payment
date. This is cash-cost reporting from driver entries, not an accrual ledger or
proof that every cost has been entered. Manufacturer-specific schedules and
vehicle-cost estimates require separate evidence and configuration.

## Alternatives

Automatically creating an expense for each service would introduce two mutable
representations without resolving existing duplicates. Automatically matching
equal costs would merge legitimate payments. Deducting both estimates and actual
payments would mix two accounting bases. None is adopted.
