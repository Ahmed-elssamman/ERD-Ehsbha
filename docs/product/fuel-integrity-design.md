# Fuel purchase and consumption integrity

17 September 2026. Implementation in progress under the full master goal.

## Evidence

The current fuel controller supports CRUD, but no driver page consumes it.
Fuel writes update the vehicle odometer only upwards; corrections/deletion leave
a previously mistyped high reading behind. Records lack versions, reversible
deletion and correction history. Lists truncate without a cursor. Fuel quantity,
unit price and odometer are mandatory even when only the payment is known.

The efficiency engine's rolling fallback counts the opening purchase against
distance driven after that purchase. Recommendations combine multiple vehicles'
odometers. Their recent result is appended to generated candidates rather than
passed into the comparison context, so the intended comparison is not evaluated.

Official guidance retrieved successfully on 17 September 2026:

- US DOE/EPA, [How to Calculate Your MPG](https://www.fueleconomy.gov/mpg/MPG.do?action=calcMPG):
  record an initial full tank and odometer, then the next full tank's quantity and
  odometer; divide distance since the opening fill by fuel added afterwards.
- [Fuel purchase records](https://www.fueleconomy.gov/mpg/MPG.do?action=purchaseRecord)
  describes recording refuelling information for mileage, expenditure and economy.

The source supports the liquid-fuel full-to-full method, not applying a litres
formula to electric charging or compressed gas. No current Egyptian fuel price,
manufacturer interval or undocumented integration is assumed.

## Intended implementation

- Add a reachable, mobile AR/EN purchase page. Vehicle, date and actual payment
  are the minimum entry. Quantity, unit price and odometer can be missing rather
  than invented. Use fuel kind and appropriate units; preserve unknown kind/unit
  for legacy records instead of inferring historical fuel from today's vehicle.
- Retain source quantities and payments independently. Do not silently overwrite
  a receipt amount with quantity multiplied by price. Show disagreement for
  correction, including the distinction between a recorded and derived price.
- Add driver-scoped cursors, complete period totals, guarded correction/history,
  archive/restore, retained source identity and HTTP retry fingerprints. Reuse
  driver locks and atomic source/projection/history transactions.
- Support an explicit link to a matching Other expense. The active expense is
  the canonical payment date; otherwise the active fuel record supplies it.
  Prevent links from simultaneously representing a service and a fuel payment.
  Equal amounts alone never merge records.
- Reconcile vehicle mileage from explicit manual/legacy baselines and active
  dated source readings. New corrections must retract their former contribution.
  Do not infer provenance for legacy mileage or silently discard a manual
  reading. Guard manual and fuel writers with the same driver lock.
- Calculate economy for one vehicle and liquid-fuel family at a time. Use
  completed full-to-full cycles, excluding the opening purchase. Include partial
  fills inside the cycle. Require the driver's confirmation that all fills in
  the cycle were recorded. Missing quantities, missing boundary odometers,
  ambiguous time ties, rollback, incompatible fuel or declared gaps invalidate
  a cycle. Missing results stay null. Average by total distance/quantity rather
  than averaging ratios. Preserve valid later cycles after a rejected cycle.
- Compare disjoint recent/baseline windows for the same vehicle with sufficient
  completed cycles. Carry vehicle and evidence windows into any recommendation;
  describe a recorded change, not a mechanical diagnosis.
- Extend the still-unpublished coordinated major-2 contract manifest honestly,
  migrate existing source data without invented history, and rebuild any changed
  projections before exposing them to reports.

## Acceptance

Verify actual cash totals and linked costs across Cairo day/week/month moves;
two vehicles and fuel types; zero/missing/invalid quantities and mileage; ties,
partial fills, gaps, incomplete boundaries and weighted cycles; scope isolation,
version races, lost responses, archive/restore and history privacy; rollback,
legacy projection/mileage transition and retracting corrected odometer values;
complete paged lists; readable Arabic 320px and English journeys with loading,
empty, error and poor-network recovery. Measure representative query and write
costs, run the root gate, and retain evidence limits. Fuel and the full goal are
not complete merely because the calculation engine passes its unit tests.
