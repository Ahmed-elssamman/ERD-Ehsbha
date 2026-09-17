# Wellness and work-indicator checkpoint — 17 September 2026

This checkpoint addresses the unsafe health inferences and the missing practical
wellness flow. It does not close all 35 master requirements. Configurable server
notifications, background delivery, and automatic reports remain separate work.

## Changes and rationale

- Added `/wellness`: opt-in hydration, break, movement, elapsed-work-period and
  tiredness-awareness reminders; configurable frequency and Cairo quiet hours;
  snooze, skip today, disable and pause; daily checklist and seven-day summary.
- Replaced invented check-in defaults and fatigue percentages with explicit
  unrecorded/done/skipped answers. A reminder action never fills the checklist.
- Persisted account-scoped device data in validated IndexedDB transactions.
  Claims serialize across tabs; writes are confirmed only after commit. Account
  changes hide stale local views, exit clears records, explicit reset is confirmed,
  and storage failures remain visible. Old unowned check-ins are not assigned to
  a new account. Seven-day pruning occurs on access, since a closed browser cannot
  execute retention jobs.
- Foreground reminders recover from visibility changes using stored due instants,
  without replaying every missed tick. Minimum five-minute spacing and a
  sixteen-hour timer expiry prevent forgotten timers from continuing indefinitely.
  These are product controls, not safe work/rest limits. The page explains that
  OS permissions are not requested and closed-app delivery is unavailable.
- Work indicator version 2 compares financial results with earlier recorded days
  and describes variation in work minutes. It has no health/safety dimension,
  returns null for missing evidence, and explains its weights and limitations.
  Both driver and admin responses explicitly omit legacy safety fields.
- Preserved version 1 database snapshots under a driver/date/version key. Retired
  stored high-fatigue recommendations and the calculation that inferred sleep from
  work gaps, including the now-unused rolling workload reader and its isolated
  reader fixtures. Financial work-time union/projection tests remain. Invalidated older browser query caches to prevent stale inferred
  scores from returning offline.
- Corrected a related offline failure: retryable refresh failures (network,
  timeout, rate limit, server outage) preserve the current account and local
  records. Rejected credentials still sign out. Existing account-switch fencing
  remains in place.

## Architecture and standards

The actual React/NestJS architecture is retained. New wellness behavior uses
strict interfaces/enums, companion controls, validated persistence, small domain
functions, reusable hooks, localized Arabic/English copy, native accessible
controls and responsive logical-direction layouts. No health profile is sent to
the server. [ADR-0015](../adr/0015-wellness-and-work-indicators.md) records the
decisions and official guidance sources.

Visual review at 320px moved longer guidance into native disclosures, kept the
delivery limit visible, and used foreground-colored links/status text for contrast
in both themes. Disclosure controls and links have at least 44px touch height.
Skipped reminders show their Cairo-day status and can be resumed explicitly.

## Files created or changed in this checkpoint

New driver files:

- `apps/web/src/lib/wellness/wellness.control.ts` and `.spec.ts`
- `apps/web/src/lib/wellness/wellness-store.ts`
- `apps/web/src/lib/wellness/use-wellness.ts`
- `apps/web/src/components/wellness/wellness-reminder.tsx`
- `apps/web/src/pages/wellness/wellness.tsx`
- `apps/web/src/pages/driver-score/driver-score.control.ts`
- `apps/web/tests/browser-integration/wellness.spec.ts`

Changed driver files:

- `apps/web/src/pages/driver-score/driver-score.tsx`
- `apps/web/src/pages/dashboard/score-card.tsx`
- `apps/web/src/components/layout/app-layout.tsx` and `sidebar.control.ts`
- `apps/web/src/router.tsx`
- `apps/web/src/providers/query-provider.tsx`, `account-query-cache.ts`, and its test
- `apps/web/src/lib/api/client.ts`, its test, and `endpoints.ts`
- `apps/web/src/i18n/en.json` and `ar.json`

API, contracts and admin:

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260923000000_work_score_semantics/migration.sql` (new)
- `apps/api/src/modules/score/score.service.ts` and `score-response.ts` (new)
- `apps/api/src/modules/analytics/engines/score.engine.ts` and its test
- `apps/api/src/modules/analytics/engines/recommendation.engine.ts` and its test
- `apps/api/src/modules/recommendations/recommendations.service.ts`
- `apps/api/src/modules/recommendations/recorded-workload.ts` (removed after its consumer was retired)
- `apps/api/src/modules/admin/admin-drivers.service.ts`
- `packages/api-contracts/src/domains/analytics-intelligence.ts` and `admin-core.ts`
- `packages/api-contracts/src/catalog/release.ts` and regenerated catalog/OpenAPI
- `apps/admin/src/pages/driver-detail.tsx`, `driver-detail.control.ts` (new), and `apps/admin/src/i18n/dict.ts`
- `apps/api/scripts/verify-work-score.ts` (new), `verify-work-sessions.ts`, `test-integration.ts`
- `scripts/verification/verify.mjs`
- This checkpoint, the wellness audit, ADR-0015 and engineering roadmap

## Verification

Final root run **2026-09-17T07-49-37-712Z-5612** passed, completed
**2026-09-17T07:57:43.183Z**. Log:
`verification-output/wellness-root-verify-2.log`.

- All lint, API/web/admin typechecks, API and shared-package unit tests, contract
  catalog/OpenAPI, dependency boundaries, route/ADR/security audits, and all three
  production builds passed. The final UI contrast changes also passed a separate
  lint run before browser/build verification.
- **25 PostgreSQL checks** passed, including clean migration, version 1 snapshot
  preservation, version 2 upsert, missing observations, owner-scoped history, and
  existing financial/source/draft integrity suites.
- **46 HTTP smoke checks** passed.
- **54 browser cases** passed: 18 intercepted and 36 real API/database journeys;
  zero failures, skips or flakes. Five wellness/work-indicator journeys cover
  offline settings/checklist reload, frequency changes, shared-tab claims,
  skip/resume, account switching/sign-out, Arabic 320px layout, storage failure,
  explicit recovery from an unreadable record, missing score evidence and read
  errors. Final Arabic screenshot: `verification-output/wellness-ar-320.png`.
- **71 driver-web unit tests** passed, including scheduling/Cairo/DST semantics,
  retryable versus rejected refresh credentials, and old score-cache invalidation.
  Log: `verification-output/wellness-web-unit-final.log`.
- **665 supplementary Node checks** passed.
  Log: `verification-output/wellness-supplementary-final.log`.
- **79 measured build artifacts** stayed within budget. Wellness route
  `assets/wellness-IzpemjM4.js`: 20,350 raw / **3,448 compressed bytes**;
  work indicators `assets/driver-score-BJI9TJRY.js`: 10,147 raw /
  **1,804 compressed bytes**. These route measurements exclude shared dependencies.
- Contract inventory remains **188 operations / 41 controllers / 156 paths**;
  route audit contains **275 coverage records**. Final root security scan passed
  across 4,906 files; whitespace validation is clean.

The earlier root run `2026-09-17T07-39-52-731Z-26192` also passed before the final
review refinements. Focused browser run `wellness-browser-4.log` passed all five
new journeys. These are local diagnostic checks in the existing dirty worktree
(`authoritative=false`), not deployment or production-load evidence. No production
database was used. Configurable server notifications, background delivery,
cross-device wellness/report integration, and other master requirements remain
open in the roadmap and notification audit.
