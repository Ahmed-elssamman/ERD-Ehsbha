# Notification delivery checkpoint

Updated: 2026-09-17. This checkpoint covers the existing notification inbox,
delivery preferences, and work digest producer. The complete master goal remains
unfinished; this is not a deployment or production-readiness assertion.

## Implemented behavior

- Owner-scoped timestamp/ID pagination, visible load/continuation/read failures,
  explicit retries, stable first-read timestamps, and bounded mark-displayed work.
- Saved automatic digest enablement, Cairo time, quiet hours, and daily/three-day/
  weekly cadence. Offline edits and unconfirmed requests use account-owned drafts
  and exact-body mutation receipts with version conflicts.
- Database-enforced one digest per driver/Cairo day across manual and scheduled
  calls. Bounded driver scans, preference-aware scheduling, and recipient locale.
- Version 2 snapshots with saved evidence dates/counts, safe integer currency,
  complete-day windows, actual sample thresholds, correct goal dates, and explicit
  separation of take-home trip income from recorded operating net.
- Preserved historical rows; legacy day identities backfilled without deleting
  duplicates. Previous comparisons/targets lack sufficient stored evidence and
  are not rendered. Cross-account device-token reassignment is rejected.

The detailed decisions and scheduler documentation sources are in
[ADR-0016](../adr/0016-notification-delivery-and-digest-evidence.md).

## File inventory

| Area | Changed / created files |
| --- | --- |
| Database | `apps/api/prisma/schema.prisma`; migration `20260924000000_notification_delivery/migration.sql` |
| Shared contracts | `packages/shared-types/src/notifications.ts`, `index.ts`; `packages/api-contracts/src/domains/communications.ts`, `notification-settings.ts`, `index.ts`; `core/errors.ts`, `catalog/release.ts`; generated catalog/OpenAPI and catalog route count |
| API | `apps/api/src/modules/notifications/` controller, module, services, preference service, response mapper, controls, digest model/reader/copy, and unit tests; common mutation receipt operation enum |
| Driver UI | `apps/web/src/pages/notifications/` inbox, preference editor/API/control/tests; `components/notifications/daily-digest-card.tsx`; `lib/api/endpoints.ts`; record-draft kind; account cache version; Arabic/English dictionaries |
| Admin | Governed error translations in `apps/admin/src/i18n/dict.ts` |
| Verification | `apps/api/scripts/verify-notifications.ts`, integration registration, root mandatory check; real and intercepted browser notification specs; wellness sign-out navigation assertion |
| Documentation | ADR-0016, this checkpoint, original audit, engineering roadmap, automatic-reporting audit |

## Verification status

Final root run **`2026-09-17T08-42-37-375Z-22844` passed**, completed at
`2026-09-17T08:50:55.027Z`; log: `verification-output/notification-root-verify-3.log`.
All 26 required PostgreSQL checks, 46 HTTP smoke checks, lint, types, API/shared
unit tests, contracts, boundaries, production builds, routes, ADR and security
checks passed. All 58 browser cases passed: 19 intercepted and 39 real API/DB
journeys, with zero skips, unexpected failures, or flaky results. Separately,
75 driver web unit tests and 672 supplementary repository checks passed.

Contract inventory: 190 operations, 41 controllers, 157 OpenAPI paths. All 80
measured artifacts meet their budgets; the notifications route chunk is 28,128
raw bytes / 5,739 compressed bytes, excluding shared dependencies. Route coverage
contains 275 records. The final root security scan covered 4,992 files. The
Arabic 320px settings view was visually inspected; screenshot:
`verification-output/notifications-ar-320.png`.

Review corrections included a concurrent device-token registration race and a
comparison-limit case that previously could report insufficient history. The
database tests now reject the token race and require a truthful limit notice.
An earlier root run exposed a wellness test that navigated before sign-out
completed; it now waits for the login route. The full final run includes that
correction. Earlier interrupted/failed runs are not acceptance evidence.

This is diagnostic evidence for the inherited dirty worktree
(`authoritative=false`), not a deployment or committed revision. Existing React/
NestJS structure, typed shared contracts, companion controls, account boundaries,
and Arabic/English presentation were retained.

## Remaining scope

No browser push implementation or production push permissions/delivery validation
is claimed. Maintenance, license, and report notification producers, automatic
weekly/monthly report delivery, production deployment/monitoring, representative
OCR acceptance data, and other master requirements remain on the roadmap. Local
wellness reminders retain their separate device settings and privacy boundaries.
