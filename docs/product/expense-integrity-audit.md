# Expense integrity follow-up

17 September 2026. Open work under master sections 11, 21, 23 and 29. The Cairo
calendar implementation does not solve these separate accounting and UI issues.

| Priority | Evidence | Consequence |
| --- | --- | --- |
| High | `apps/api/src/modules/aggregates/aggregate-calculation.ts`, `dailyTotals`; `apps/api/prisma/schema.prisma`, Expense | Trip toll/parking fields and independently entered expenses both contribute. There is no relationship proving that two records represent the same cost. An automatic amount/date match would risk removing legitimate expenses. |
| High | `apps/web/src/pages/expenses/expenses.tsx`, month total; `apps/api/src/modules/expenses/expenses.service.ts`, list | The UI calls a maximum-50-row list and sums that page as the month's total. Drivers with more records see an understated total; list load failure also resembles an empty month. |
| High | `aggregate-calculation.ts`, groupTotals; `analytics.service.ts`, hours | Platform/area contributions and hourly earnings lack a complete allocation of operating costs but are exposed/displayed as net profit. Their ratios are not equivalent to the driver's operating net. |
| High | `dailyTotals`, maintenance inputs | Daily projections retain an existing maintenance estimate. This does not establish a complete accounting policy for actual service costs, amortization and fuel costs. |

Implementation must preserve source facts and provide an explicit, reversible
way to link two representations of the same cost. Define which source controls
the amount and reporting date; enforce driver/vehicle ownership, supported fee
category, one-to-one identity, and amount agreement under the driver write lock.
Link, unlink, source edit, deletion and restoration must reconcile affected
dates and all period projections, with correction history. Do not silently
rewrite one financial record to match another.

Expense totals and breakdowns need complete server-side aggregation for an
explicit Cairo interval, independently of list pagination. The list needs a
bounded cursor and stable order so older records remain reachable. Failures
must retain the form and offer a specific retry action. A newly opened expense
form should refresh its current-time default without resetting edits while the
dialog remains open; the existing dialog initializes its defaults on page mount.

Comparison views should state exactly which costs are included and excluded.
Use earnings/contribution terminology until an evidenced allocation exists.
Do not invent fuel, maintenance or platform costs to produce a more complete
looking number. Add PostgreSQL and browser tests for more than one page of
expenses, equal-valued distinct costs, explicit links, conflicting edits,
cross-date changes, owner isolation, retries and rollback.

Implementation of explicit expense links, complete summaries, paging, versioned
edits, financial history and comparison terminology is described in
`expense-integrity.md`. Its final verification status is recorded there.
Maintenance/fuel accounting and correction history for other source types
remain open in the full product goal.
