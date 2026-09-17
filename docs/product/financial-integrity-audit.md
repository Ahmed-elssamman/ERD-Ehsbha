# Financial integrity audit

17 September 2026. Active work under master sections 9, 11, 21, 23 and 29.
These are initial code findings and acceptance requirements. Reconciliation work
and its remaining limits are recorded below and in `financial-reconciliation.md`.
The earlier OCR confirmation checkpoint protects a trip and its aggregate mutations in one
transaction. It does not establish correctness of every aggregate or report.

## Findings

| Priority | Source | Behavior and impact |
| --- | --- | --- |
| Critical | `analytics/nightly-aggregates.job.ts`, `recomputeDay` | Deletes only daily aggregates, then calls incremental trip/fuel/expense/session writers. Those writers also increment weekly/monthly/app/area records. Re-running a day therefore inflates other totals; source reads and rebuild are outside one transaction. |
| High | `aggregates/aggregates.service.ts`, `applyTrip` and `recomputeRatios` | Daily net deducts commission and includes tips. Weekly/monthly store gross without those components, then label gross minus operating expenses as net. The same trip produces inconsistent period profit. |
| High | Same service and `analytics/engines/profit.engine.ts` | Trip toll/parking amounts are not part of aggregate deltas; the shared arithmetic is duplicated. Waiting fee is a fare breakdown and must never be added to gross again. |
| High | `sessions/sessions.service.ts`, `start`/`end` | Open-session checks and end-state reads happen before writes; competing calls can create multiple open sessions or apply duration twice. Trip time and online-session time are also added together without an explicit overlap rule. |
| High | `analytics/analytics.service.ts` and aggregate date helpers | Reporting uses UTC calendar buckets while driver capture uses Cairo instants. Midnight and DST boundaries need explicit Egyptian business-day semantics before changing existing buckets. |
| High | Trip schema, OCR validation and analytics contracts | Required gross/commission prevents recording an honestly net-only source. Nullable evidence, known subtotals and coverage counts must be represented throughout write/read/aggregate/UI contracts; zero is not a substitute for missing evidence. |
| High | App/area aggregate serialization | Platform revenue after commission is named net profit despite unallocated operating costs. Reports must distinguish take-home revenue, operating costs and net operating income. |

Weekly/monthly outputs are consumed by driver analytics and administration;
app/area totals feed driver comparisons and admin driver detail. These are active
product surfaces, not unused tables. Existing tests of atomic writes do not cover
nightly repeatability or cross-period reconciliation.

## Next implementation sequence

1. Add a real PostgreSQL reconciliation regression before changing arithmetic:
   two dates, multiple platforms/areas, trip commissions/tips, fuel, expenses and
   sessions; rebuild the same day twice and compare every aggregate family.
2. Make rebuilding deterministic and transactional. Coordinate all source
   mutations with the same driver lock, replace affected projections, and derive
   weekly/monthly totals without replaying increments into existing rows. Preserve
   other dates and drivers and provide an explicit repair/backfill procedure.
3. Centralize money/duration contributions with transparent semantics and test
   daily/weekly/monthly equivalence, concurrent source edits, rollback, deletion,
   zero denominators, negative net, and integer bounds. Do not double-charge tolls
   or parking when they also appear as a separate expense.
4. Extend the financial representation for missing gross/commission/net-only
   evidence. Carry coverage and uncertainty through OCR/manual entry, source
   history, APIs, driver/admin analytics and reports. Never silently impute fees.
5. Apply an explicit Cairo business-day policy, reconcile old rows, and verify
   midnight, cross-day trips and DST. Then broaden real browser acceptance to
   manual capture, finance, comparisons and reports.

The full 35-section roadmap remains active, including market/provider research,
wellness, administration, offline behavior, accessibility and production operations.

## Reconciliation implementation

The nightly inflation, period commission/tip inconsistency and session races now
have a common source-derived replacement path. Driver locks serialize source
writes with rebuilds; rollback includes every affected projection. Trip toll and
parking fields contribute to expenses, working intervals are unioned and clipped,
and the development seed uses the same arithmetic. A preview-first repair command
can reconcile old data without modifying its source transactions.

Real PostgreSQL regressions reproduce the original inflation and verify repeated
rebuilds, corruption repair, competing edits/session calls/deletes, rollback,
cross-period boundaries, driver isolation and repeated full repair. Local load
measurement and detailed semantics are in `financial-reconciliation.md`.

Net-only evidence now has a shared resolver, nullable source facts, explicit
tips-inclusive income, aggregate completeness counters and driver/admin read
support. Manual and OCR capture, edits, retry, migration and PostgreSQL/browser
evidence are described in `net-only-income.md`.

Cairo buckets, actual DST day boundaries, shared manual/OCR time resolution and
atomic legacy projection cutover are implemented in `cairo-reporting-calendar.md`.
That document tracks the verification evidence and operational requirements.

The remaining findings are still open: accurate platform/area terminology, maintenance/fuel estimates,
explicit linking of the same toll/parking cost across trip and expense records,
and complete correction audit history. Fixing deterministic arithmetic does not
by itself complete financial analytics or the full product goal.
