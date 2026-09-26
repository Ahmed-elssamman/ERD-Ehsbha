# ADR-0015: Optional local wellness and factual work indicators

**Status**: accepted
**Date**: 2026-09-17
**Owner**: Driver product and platform teams

## Context

The driver-score page contains an existing local check-in, contrary to the first
wellness audit's incomplete search. It stores sleep, feelings, stress, meals,
weather and hydration in an unscoped localStorage key, substitutes invented
defaults, ignores write failures, and computes an unsupported fatigue percentage.
It then adjusts a backend safety score. The backend separately guesses sleep from
gaps in recorded work and emits a definitive high-fatigue recommendation. Neither
formula is validated as a health or safety assessment.

## Decision

Replace the wellness check-in with an optional, account-scoped device workflow.
Keep only reminder preferences and seven Cairo calendar days of checklist answers
in IndexedDB. Do not upload symptoms, sleep, health assessments, or checklist data
to administrators. Clearly disclose device scope, offline operation, retention,
and removal at sign-out/browser-data clearing. Do not assign the old unowned
localStorage check-ins to whoever happens to sign in; remove that legacy key at
account exit. Provide explicit reset with confirmation, including for an
unreadable local record.

All five reminders start disabled. Drivers choose frequency, start/pause the
reminder period, and configure Cairo quiet hours. They can dismiss, snooze fifteen
minutes, skip until Cairo midnight, or disable a reminder. Starting a reminder
period measures elapsed wall time, including gaps, not driving, sitting, sleep,
or work recorded in the financial domain. The work-time page remains available
for actual recorded periods. A reminder period expires after sixteen hours to
avoid forgotten timers continuing into later days; this is a product limit, not
a safe driving duration or legal limit.

Display reminders inside the visible authenticated app. Persist due instants,
recover on visibility, suppress catch-up floods, and atomically claim a due
reminder in an IndexedDB transaction shared by tabs. Do not request browser
notification permission or claim that page timers can wake a closed PWA. Background
push delivery and the existing server notification inbox are separate remaining
work; arbitrary device tokens do not implement web push.

Checklist answers start unrecorded, can be done/skipped/unrecorded, and are never
inferred from a timer, dismissal, or missing record. The seven-day summary reports
these exact counts without a compliance percentage or health score. General
guidance references the retrieved UK Highway Code and NHS sources in the product
audit. UK break guidance is explicitly not presented as Egyptian law.

Work score version 2 contains only personal business indicators: net income per
kilometre, net income, and variation in recorded work minutes. Financial values
are compared with the median of at least three prior recorded days in the previous
thirteen days; distance is required for the per-kilometre dimension. Missing or
zero financial baselines yield null. Improvement from a negative baseline counts
as improvement. The product weights are 7:5:3, documented without claiming an
industry benchmark. Variation is descriptive, not encouragement to avoid breaks
or work longer. Overall is null unless all components exist.

Preserve version 1 snapshots in PostgreSQL, including their historical values, but
exclude them from both driver/admin views. Use a compound driver/date/version key
so computing version 2 never rewrites version 1. Explicit response mapping omits
legacy safety fields. Retire stored fatigue-high recommendations. Invalidate the
older persisted browser query cache so old inferred scores/recommendations cannot
reappear offline. Mark score history as incompatible in the coordinated contract
2 release, alongside already-incompatible today/admin driver operations.

## Alternatives

Renaming a fatigue percentage would retain the unsupported inference. Continuing
to store wellness under one unscoped browser key would mix accounts. A server
health profile would collect unnecessary sensitive data. Sending OS notifications
from an ordinary page timer would not provide reliable closed-app delivery.

## Consequences

Device-local wellness does not synchronize across browsers or feed server-generated
reports. Browser storage can be unavailable or evicted; show a recoverable error
and never confirm an uncommitted write. The existing financial and trip-draft
protocol remains separate. This decision does not close the master requirements
for configurable maintenance/report notifications or automatic report delivery.

## Verification

Verification evidence is recorded in the wellness checkpoint after the final root
run. Cover Cairo/DST calendar days, quiet hours, missing checklist answers,
snooze/skip/expiry, real local storage, multiple tabs/accounts, offline reload,
Arabic mobile layout, storage failure, score versioning, missing financial
observations, and preservation of historical snapshots.
