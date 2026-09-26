# Maintenance and fuel integrity follow-up

17 September 2026. Open master work after explicit expense linking; these
findings are not resolved by the expense checkpoint. The subsequent
`maintenance-cash-integrity.md` checkpoint addresses recorded payments, guarded
service corrections/history and missing-history guidance. Confirmed schedules,
vehicle cost assumptions and fuel measurement remain open.

The later `fuel-integrity-checkpoint.md` implements purchase entry, corrections,
links, reversible deletion, scoped consumption evidence and dated mileage
reconciliation. The table below preserves the initial audit findings; consult
the two checkpoint ledgers for current implementation and verification status.
Confirmed schedules, complete vehicle-cost assumptions and the remaining fuel
follow-ups are still part of the active master goal.

| Finding | Source evidence | Required outcome |
| --- | --- | --- |
| Actual maintenance payments do not feed daily operating totals | `maintenance.service.ts`, `addRecord`, writes only a service record; `aggregates.service.ts`, `replaceDay`, reads fuel/expenses and retains the previous maintenance estimate | Define recorded cash spending separately from estimated wear/maintenance reserves. Include actual service costs exactly once, with an explicit policy for historical estimates and overlapping expense records. |
| Maintenance writes bypass the driver write lock, projections, source idempotency and correction history | `MaintenanceService.addRecord` is a direct create | Apply the same ownership, concurrency, source/projection transaction, retry, version and history discipline as other financial writers. Preserve legitimate zero-cost service records. |
| Missing maintenance history implies service at zero odometer | `MaintenanceService.risk` chooses `lastKm = 0`; `computeMaintenanceRisk` substitutes distance usage for missing service time | Show insufficient history separately from evidence that service is overdue. Manufacturer/user schedules need vehicle applicability and provenance; do not invent a last-service date or mileage. |
| Risk reads perform one service query per item | `MaintenanceService.risk` loops over maintenance items and awaits `findFirst` | Measure and replace the repeated lookup with a bounded query or grouped latest-record read. Test ties and future/backdated corrections. |
| A planning assumption is displayed as real operating cost | `vehicle-cost.engine.ts` uses a default 3,000 km/month, returns zero for missing component inputs, and labels the sum real cost/km | Keep driver-supplied assumptions, missing components and actual recorded cost distinct. Never claim a complete real cost from absent inputs. Zero can be a known value and must not always mean missing. |
| Rolling fuel efficiency counts the first purchase against distance after its odometer | `fuel.engine.ts` fallback sums every purchase but uses last-minus-first odometer | Establish the supported tank-to-tank evidence and limitations of partial fills. Do not present an unbounded fuel-in-tank assumption as measured efficiency. Add boundary/tie/odometer correction tests and missing-data output. |
| Fuel recommendations combine odometers from different vehicles | `recommendations.service.ts`, `generateForDriver`, reads all driver fuel logs and maps them into one sequence without vehicle identity | Calculate evidence separately for each vehicle; never infer a distance between two vehicles' odometers. Surface the vehicle and evidence window with any recommendation. |
| Fuel purchases have no reachable driver entry screen | `FuelApi` exposes list/create in the client adapter, but the current page/component search finds no consumers or fuel route; `vehicle-health` edits planning assumptions instead | Add the actual purchase workflow, with correction/history/retry and measured-consumption states. Keep recorded purchases separate from tank-cost planning inputs. |

Before further implementation, inspect the vehicle cost editor, fuel and maintenance
screens, report readers, service item configuration and notification consumers.
Research reliable vehicle/manufacturer guidance where service schedules or fuel
measurement claims are uncertain. Egypt fuel prices must remain recorded or
explicitly sourced values; no current price or universal service interval is
established by this audit.

Acceptance must cover actual versus estimated costs, two vehicles, distinct
equal payments, explicit duplicate links where needed, service date moves across
Cairo day/week/month boundaries, deletion/restoration, version conflicts,
unknown history, scope isolation, lost-response retries, audit privacy and
source/projection rollback. Verify the driver can complete the flow in both
languages on a small phone. Reconcile every report consumer and document any
necessary coordinated contract transition.
