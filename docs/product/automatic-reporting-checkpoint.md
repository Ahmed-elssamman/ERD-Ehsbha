# Automatic reporting checkpoint — 17 September 2026

Completed saved weekly/monthly financial reports, revision history, and automatic
inbox delivery. This is a verified checkpoint within the larger 35-section product
roadmap, not a claim that the entire platform is production ready.

## Behavior and architecture

- `/reports` lists saved reports and offers creation for a completed Cairo
  Monday–Sunday week or calendar month. Creating an existing period opens its
  latest saved version. Explicit revisions preserve earlier versions and require
  the expected current version. Archive and history use owner-scoped pagination.
- Financial snapshots contain current/previous totals, gross/commission coverage,
  recorded net income, expenses, fuel/service records, distance, unioned work
  time, available hourly/kilometre ratios, platform contribution, vehicle costs,
  largest costs, and daily results. Missing records/denominators remain explicit.
  Recorded costs reconcile against the cash ledger; linked payments count once.
- Weekly/monthly automation checks the latest completed periods every 15 minutes,
  with separate preferences, Cairo quiet hours, driver locks and a unique event
  key. One inbox notice per period links to its exact saved version. There is no
  backlog flood. Empty financial/work snapshots are not automatically announced.
- Create/revise/settings requests use durable account-scoped browser drafts and
  server mutation receipts. Lost responses retry the same body and key; stale
  versions cannot overwrite current state. Previously opened reports can be read
  from the account cache during network failures.
- Arabic/English, RTL/LTR, touch targets, keyboard dialogs, empty/loading/error
  states and a compact mobile layout are implemented. Daily rows expand on demand.
  Wellness answers remain device local and separate from financial snapshots;
  the seven-date retention limit and absent answers are stated explicitly.

The existing React/NestJS architecture is retained. Shared strict contracts/enums,
companion control files, bounded readers, transaction locks and existing draft
infrastructure follow the repository's applicable standards. No new dependency
was added. [ADR 0017](../adr/0017-automatic-reports.md) records the design and limits.

## Files created or changed for this checkpoint

Backend report module, all under `apps/api/src/modules/reports/`:

- `reports.module.ts`, `reports.controller.ts`, `reports.service.ts`,
  `reports.control.ts`, `reports.spec.ts`.
- `report-calculation.ts`, `report-cash-reader.ts`, `report-reader.ts`,
  `report-response.ts`, `report-history-cursor.ts`.
- `report-preferences.service.ts`, `report-delivery.service.ts`,
  `report-message.control.ts`.

Driver report feature, all under `apps/web/src/pages/reports/`:

- `reports.tsx`, `report-detail.tsx`, `reports.api.ts`, `reports.control.ts`,
  `reports.control.spec.ts`.
- `report-editor.tsx`, `report-draft.control.ts`, `report-wellness.tsx`,
  `report-preferences-editor.tsx`, `report-preferences.control.ts`.

Shared definitions and persistence:

- `packages/shared-types/src/report.ts`, `report.spec.ts`, `notifications.ts`,
  `index.ts`.
- `packages/api-contracts/src/domains/report-records.ts`, `communications.ts`,
  `index.ts`, and `packages/api-contracts/src/core/errors.ts`.
- `apps/api/prisma/schema.prisma` and
  `apps/api/prisma/migrations/20260925000000_driver_reports/migration.sql`.
- `apps/api/src/app.module.ts`,
  `apps/api/src/common/operations/mutation-receipt.ts`,
  `apps/api/src/modules/notifications/notification-response.ts`.

Browser integration and localization:

- `apps/web/src/components/notifications/report-ready-card.tsx`,
  `apps/web/src/pages/notifications/notifications.tsx`,
  `apps/web/src/lib/api/endpoints.ts`.
- `apps/web/src/router.tsx`,
  `apps/web/src/components/layout/sidebar.control.ts`,
  `apps/web/src/lib/record-drafts/record-draft.model.ts`,
  `apps/web/src/providers/account-query-cache.ts`.
- `apps/web/src/i18n/ar.json`, `apps/web/src/i18n/en.json`,
  `apps/admin/src/i18n/dict.ts`.

Verification and documentation:

- `apps/api/scripts/verify-reports.ts`, `test-integration.ts`,
  `browser-report-delivery.ts`.
- `apps/web/tests/browser-integration/reports.spec.ts`.
- `scripts/contracts/catalog-data.mjs`, `scripts/verification/verify.mjs`;
  regenerated contract/OpenAPI/coverage artifacts.
- `docs/adr/0017-automatic-reports.md`, this checkpoint,
  `automatic-reporting-audit.md`, `engineering-roadmap.md`,
  `remaining-notification-producers-audit.md`.

Pre-existing changes to these and other files remain intact. No commit, production
database migration, or deployment was performed.

## Verification

Final full run: **`2026-09-17T16-15-34-943Z-20832`**, started
`2026-09-17T16:15:34.947Z`, completed **`2026-09-17T16:24:17.643Z`**.
`verification-output/report-root-verify-1.log` and `baseline-report.json` record
**overall passed**, including evidence integrity and report-schema validation.

- **27 PostgreSQL checks**, including owner isolation, linked cash costs across
  periods, missing gross values, negative net, unioned time, immutable revisions,
  replay after later versions, concurrent delivery, preference changes, rollback,
  SQL timezone independence and oversized detail groups.
- **46 HTTP smoke checks**.
- **62 browser tests**: 19 intercepted-response tests and 43 real API tests.
  Zero skipped, unexpected or flaky cases. Four reporting cases cover empty/error
  states, completed-period/quiet-hour validation, lost-response recovery, revision
  history, foreign access, offline settings conflicts, actual report notification
  delivery, Arabic 320px and cached reads during a network failure.
- All lint/types/API unit/shared-package tests, contract/boundary checks, production
  builds and ADR/security audits passed. **79 web unit tests** and **687
  supplementary Node tests** passed separately.
- **198 operations / 42 controller files / 162 OpenAPI paths**, 290 coverage
  records and 84 measured build artifacts. Security scanned 5,081 files with no
  findings in that run.
- Report archive route: **3,388 compressed bytes**; detail route: **3,546
  compressed bytes**, excluding shared dependencies. Shared report control chunk:
  3,458 compressed bytes. All measured budgets passed.
- Focused PostgreSQL capture measured **30.17 ms** over 1,200+ cost entries,
  preserving complete totals while explicitly omitting more than 200 vehicle
  groups. This is a local measurement, not a production latency guarantee.
- `verification-output/report-ar-320.png` was captured by the real browser suite;
  its 320×2704 layout and a full-resolution top crop were visually inspected.

Initial test failures were corrected before the final run: direct database
fixtures needed projection rebuilds, expense HTTP fixtures needed idempotency
headers, and the dialog test needed an unambiguous keyboard close action. No
financial consistency guard was relaxed.

The worktree is dirty, so this is diagnostic evidence (`authoritative=false`).
Final checkpoint prose was updated after the run; application sources remained
unchanged after that successful gate.

## Remaining product work

Maintenance/oil-change, licence/inspection, spending and productivity notification
producers; browser sync consumption; representative real OCR acceptance; admin
intelligence and other unfinished roadmap requirements remain open. The reporting
checkpoint does not mark that larger work complete. Browser push is not implemented
and is not a prerequisite for the implemented inbox report delivery.
