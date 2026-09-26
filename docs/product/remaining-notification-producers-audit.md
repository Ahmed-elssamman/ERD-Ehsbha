# Remaining notification producers — 17 September 2026

Read-only follow-up while the automatic-reporting regression gate ran. Daily work
digests and weekly/monthly reports now have real inbox producers, preferences,
deduplication and retry evidence. This document identifies subsequent work; it
does not claim the other producers are implemented.

## Maintenance and oil changes

`MaintenanceService.risk` reads the latest nondeleted recorded service per vehicle
and item, uses recorded manual/fuel odometer evidence, and applies generic catalog
intervals through `computeMaintenanceRisk`. The browser explicitly labels these
as generic intervals, not a schedule confirmed for the vehicle or a mechanical
assessment. Missing service/mileage is kept unknown.

There is no maintenance notification producer or per-driver delivery setting.
Vehicle cost settings contain some interval inputs for cost modelling, but they
are not a confirmed schedule for every maintenance item. Before automatically
announcing a service as due, provide explicit vehicle/item schedule configuration
or a clearly chosen catalog-based reminder with its limitation. Preserve the
unknown-evidence behavior, bound vehicle/item scans, deduplicate notifications,
and prevent repeated notices after a new recorded service. Oil change is a
maintenance item, not a separate inferred source of financial spending.

## Licence, inspection and insurance dates

The current vehicle schema has no licence/inspection expiry or renewal date.
Existing overhead estimates are not evidence for an expiry date. A reminder flow
needs dates entered by the driver, optional owned-vehicle association, editable
lead times and delivery controls, and clear completed/disabled states. Avoid
invented statutory renewal periods or interpreting an entered date as a legal
assessment. No document upload is necessary merely to support a date reminder.

## Spending and productivity

Recorded cash costs and report snapshots provide a valid financial basis. There
is no dedicated spending/productivity producer. Any comparison must state its
completed period, available sample and cost basis; linked payments count once,
and fuel/service payment timing can change daily net substantially. Missing work
time or distance cannot establish low productivity. Prefer optional factual
comparisons with sufficient history over unsupported performance or health claims.

## Shared acceptance

Keep implemented settings separate from unsupported delivery promises. Reuse
driver locks, owner-scoped data access, durable mutation receipts/drafts, unique
event identities, Cairo quiet hours and bounded scans. Test creation, correction,
disable/snooze, lost responses, concurrent schedulers, old notifications after
source changes, Arabic/English, 320px, keyboard and offline recovery on real APIs.
These are ordinary implementation tasks within the master scope, not external
blockers. The larger roadmap, including OCR evidence and admin work, remains open.
