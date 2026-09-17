# ADR-0009: Fuel purchases, consumption evidence and dated mileage

**Status**: accepted
**Date**: 2026-09-17
**Owner**: Platform team

## Context

Fuel purchases had no reachable driver page, required measurements even for a
payment-only record, and lacked correction versions/history or reversible
deletion. A rolling estimate counted the opening fill against later distance.
Recommendations combined different vehicles. Fuel corrections could not retract
the permanent maximum vehicle odometer.

## Decision

Treat an actual payment independently of optional quantity, unit price and
mileage. Rename existing quantity/price columns without changing their values.
Historical fuel kind remains null until confirmed; it is not inferred from the
vehicle's present fuel setting. Petrol/diesel use litres, CNG uses cubic metres,
and electric charging uses kWh. Unknown kind has unknown unit. Zero payment is
valid when explicitly entered. Quantity and price never overwrite the receipt.

Add source versions, archive/restore and version-ordered financial snapshots
without notes. Every write holds the driver lock and commits source, history,
old/new Cairo projections, mileage reconciliation and recommendation expiry
together. HTTP fingerprints bind the payload, record and deletion version.

Allow explicit matching Other-expense links. The active expense supplies the
payment date; otherwise the active purchase supplies it. Reject mismatched
amount/category/vehicle and occupied links. Driver locks, owner foreign keys,
partial unique indexes and an expense-row-locking trigger prevent active fuel
and maintenance records from claiming the same expense. Distinct equal payments
remain distinct. Advance financial projection version to 3 and atomically rebuild
older projections before reporting, preserving historical maintenance estimates.

Measure liquid-fuel economy only from completed full-to-full cycles for one
vehicle and fuel family. Exclude the opening purchase, include intermediate
partial fills, and require confirmation that every fill was recorded. Reject
missing consumed quantities, missing boundary mileage, backward readings, equal
timestamps, incompatible fuel and declared gaps. Weighted totals determine the
result. Missing evidence stays null; there is no rolling fallback. Gas and
electric purchases count as costs without a litres-based consumption claim.

Fuel recommendations compare disjoint Cairo calendar windows: the current
14 days and preceding 76 days, with at least two completed cycles in each. They
carry vehicle identity, cycle counts and actual covered times. They describe a
recorded change, not a diagnosis. Evidence reads cap at 10,000 records; truncated
evidence never produces an estimate. Purchase totals remain complete.

Preserve legacy mileage as an unconfirmed baseline observed at migration time.
New manual readings have a dated baseline and optimistic version. Active dated
fuel readings after the baseline can supply current mileage; corrections and
archive/restore replace or retract their contribution. Tied readings with
different values are ambiguous. Unknown/ambiguous readings return null;
unconfirmed legacy mileage is not used for maintenance risk. Saving unrelated
vehicle settings does not confirm the existing mileage.

The major-2 release is still unpublished. Its breaking-operation manifest now
includes fuel, vehicle mileage, sync payloads and affected administration
responses. The route namespace remains `/api/v1`. Old consumers/writers are not
supported through a falsely additive contract classification.

## Consequences

API, driver web, admin, migration and projection repair require a coordinated
release. No production migration or deployment is performed here. Old binaries
cannot safely interpret renamed columns, archived purchases or linked payments;
rollback requires a compatible forward fix or a validated backup restoration.
Migration rejects existing invalid constraints rather than silently rewriting
financial facts. Existing correction history is not invented.

Current mileage is a dated observation, not proof of total lifetime distance or
all driven distance. Historical manual readings, future-dated source activation,
user/manufacturer service schedules remain separate follow-up work under the
master goal. The subsequent ADR-0010 adds durable purchase, maintenance and
expense create/edit drafts, including reload recovery of pending requests.
Browser storage remains best-effort. These limits prevent a claim that the
entire fuel domain or product is production complete.

## Alternatives

Automatically inferring legacy fuel kind, auto-linking equal amounts, replacing
payments with quantity times price, pooling vehicles' odometers, or retaining a
permanent numeric maximum would manufacture facts or prevent corrections. They
are not adopted. Official measurement sources and the acceptance inventory are
recorded in `docs/product/fuel-integrity-design.md`.
