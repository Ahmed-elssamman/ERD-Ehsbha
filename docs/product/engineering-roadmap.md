# Ehsbha production engineering roadmap

Updated: 2026-09-17. Scope: all 35 sections of the supplied master engineering
instructions. This is an implementation ledger, not a production-readiness claim.
Earlier baseline reports describe older revisions and are not acceptance evidence
for this worktree.

Latest verified work: [automatic reports](automatic-reporting-checkpoint.md) adds
saved completed-week/month snapshots, immutable revisions, recorded financial
comparisons, separate local wellness evidence, and configurable deduplicated inbox
delivery. Root `2026-09-17T16-15-34-943Z-20832` passed with 27 PostgreSQL checks,
46 HTTP smoke checks, 62 browser cases, all builds/audits and 84 artifacts.
Seventy-nine web unit tests and 687 supplementary checks passed separately.
The [remaining notification producer audit](remaining-notification-producers-audit.md)
identifies the next source and configuration requirements. The complete
35-section goal remains unfinished.

Previous verified work: [notification delivery](notification-delivery-checkpoint.md)
adds reliable inbox pagination and retries, versioned delivery preferences with
durable offline drafts, one-digest-per-Cairo-day coordination, and financially
accurate versioned evidence. Final root `2026-09-17T08-42-37-375Z-22844` passed with
26 PostgreSQL checks, 46 HTTP smoke checks, 58 browser cases, all builds/audits,
and 80 artifact measurements. Seventy-five driver web unit tests and 672
supplementary checks passed. This remains dirty-worktree diagnostic evidence.
The [automatic reporting audit](automatic-reporting-audit.md) preserves its
pre-implementation findings.

Previous verified work: [wellness and work indicators](wellness-work-score-checkpoint.md)
adds configurable device-local reminders, a daily checklist and seven-day summary;
removes unsupported health/safety inference; preserves legacy score snapshots;
and protects local records from retryable authentication-refresh failures.
Final root `2026-09-17T07-49-37-712Z-5612` passed with 25 PostgreSQL checks,
46 HTTP smoke checks, 54 browser cases, all builds/audits and 79 artifact
measurements. Seventy-one driver-web unit tests and 665 supplementary checks passed.
This remains dirty-worktree diagnostic evidence, not a production-readiness claim.

[Work-session capture](work-session-capture-checkpoint.md) and the
[sync push](sync-push-checkpoint.md)/[reconciliation](sync-reconciliation-checkpoint.md)
checkpoints retain their financial/source recovery flows. The wellness change
retires the recommendation-only rolling workload reader after removing its fatigue
consumer; historical checkpoint reports describe the earlier revision. A browser
sync consumer remains open. The [notification audit](wellness-notification-audit.md)
records the inspected baseline; its inbox, preference, scheduler, locale and
financial-label findings are addressed by the latest checkpoint. Additional
notification producers remain open; automatic report delivery is now implemented.

## Repository audit

The live workspace has three applications: `apps/web` (React 19, Vite, Tailwind,
Radix, TanStack Query, Zustand), `apps/admin` (separate React administration
application), and `apps/api` (NestJS 11, Prisma 6, PostgreSQL). Four shared packages
provide API contracts, value types, UI tokens, and lint rules. No Angular or Nx
workspace exists. Preserve the working applications while addressing product and
security failures; a framework migration is not a prerequisite for fixing them.
Angular-specific component instructions apply if Angular components are introduced.
New framework-independent code must obey the strict typing and naming rules.

Existing uncommitted contract, database, frontend, and verification changes were
present when this audit began. They must be preserved and verified together.

### Routes, features, and components

The authoritative browser maps are `apps/web/src/router.tsx` and
`apps/admin/src/router.tsx`. API routes live in
`apps/api/src/modules/**/*.controller.ts`; the generated contract catalog is
checked against those controllers by `scripts/contracts/verify-contracts.mjs`.

| Surface | Existing implementation |
| --- | --- |
| Driver authentication | `/login`, `/register`, `/forgot-password`, `/reset-password`; protected layout and guest guards |
| Driver operations | `/trips`, `/trips/new`, `/trips/:id`, `/expenses`, `/fuel`, `/maintenance`, `/vehicle-health`, `/settings` |
| Driver intelligence | `/`, `/analytics`, `/driver-score`, `/smart-decisions`, `/work-planner`, `/best-hours`, `/profit-simulator` |
| Driver communication | `/notifications`, `/guide`, `/community`, `/reviews`, `/support`; not-found handling |
| Admin identity/operations | `/login`, `/users`, `/users/:id`, `/drivers`, `/drivers/:id`, `/trips`, `/trips/:id`, `/vehicles`, `/roles`, `/settings` |
| Admin intelligence/support | `/`, `/analytics`, `/revenue`, `/community`, `/reviews`, `/support`, `/support/:id`, `/notifications`, `/audit`, `/health`; not-found handling |
| Shared presentation | Both apps have layout, theme, translation, and UI primitives; web additionally has PWA controls, OCR upload/review components, chart/error boundaries, and daily digest |
| API domains | Identity, drivers, vehicles, apps, areas, trips, OCR, sessions, fuel, expenses, maintenance, goals, analytics/aggregates, recommendations, score, notifications, sync, community, reviews, support, admin, health, idempotency |

Driver routes mostly lazy-load, but the dashboard is eager. Admin routes import all
pages eagerly. Existing static route audits are useful inventories, but checking
for a translation call or error branch does not prove usable behavior or WCAG
compliance. All listed routes still need browser verification.

### Persistence and business logic

`apps/api/prisma/schema.prisma` is authoritative. User owns Driver and authentication
tokens. Driver owns vehicles, enabled apps (linked to AppSource), areas, trips,
sessions, fuel logs, expenses, maintenance records, goals, recommendations,
notifications, scores, and daily/weekly/monthly/app/area aggregates. Trips link to a
vehicle, driver app, and optional area. Community, reviews, support, administrator
identity/roles/permissions/sessions/audit/settings, and scoped idempotency records
also exist. Money is stored in integer piastres; distances in meters.

Analytics engines already cover profit, fuel, maintenance, score, recommendations,
and vehicle costs. Source-derived transactional reconciliation now replaces the
incremental aggregate and nightly replay paths, with real database regressions.
Trip save, OCR review and manual entry now share the financial-evidence resolver.
Trip provenance, import batches, correction history,
wellness settings/checklists, and product/OCR event records were absent at audit.
Persisted OCR batches/images, initial confirmation provenance and correction
snapshots are now implemented. Audit history for subsequent manual edits/deletion,
wellness and the other missing domains remain open.

### Initial findings, in priority order

| Priority | Evidence | Required correction |
| --- | --- | --- |
| Critical | Trips/fuel/expenses/sessions use globally unique `clientMutationId` and return matches without checking driver; submitted foreign keys are not owner-checked | Scope retry identity and related objects to the authenticated driver, including sync/batch paths; exercise real services and database constraints |
| Critical | `ocr.service.ts` single mode merges all screenshots; unknown platform defaults to Uber; summary times assume PM and local clocks are treated as UTC | Preserve per-document/per-trip identity, mixed-platform detection, uncertain dates, and Cairo timezone semantics |
| Critical | `ocr-to-trip.ts` and trip-new select fallbacks for missing facts; provider fare/received meanings differ | Never manufacture amounts, time, vehicle, or platform during confirmation; require correction only where evidence is incomplete |
| High | OCR limits are five files; all provider work uses unbounded `Promise.all`; one failure rejects all | Twenty-image input with bounded processing, independent results, resumable retry, content validation, and budget/rate controls |
| High | No cross-screenshot overlap or persisted trip duplicate detection; image-hash-plus-index changes with selection/order | Stable candidate identity, conservative duplicate evidence, explicit review of ambiguous matches, idempotent confirmation |
| High | Trip update bypasses combined-value validation, omits received/toll/parking updates, reads before its transaction | Validate the resulting record, centralize arithmetic, make aggregate corrections atomic and concurrency-safe |
| High | JWT driver strategy trusts token contents without account status lookup | Enforce active account/session state and revoke suspended/deleted access |
| High | PWA caches authenticated API URLs; Query persistence is shared across accounts | Isolate or remove sensitive shared caches; purge on identity changes; preserve account-scoped drafts |
| High | Batch failures return raw Prisma/error messages | Return governed safe codes and actionable localized recovery without database internals |
| High | Admin OCR KPI values are fixed zero; activity share is called retention; post count is discarded as zero | Persist defined operational events; display unavailable metrics honestly; implement cohorts and drill-down |
| High | Root `test:e2e` reports not applicable; many agreement tests mock services | Add browser journeys and real service/database isolation, retry, and financial tests |
| Medium | Sync pull advances to current time despite per-table limits | Cursor that cannot skip records; tombstones, conflict handling, browser outbox |
| Medium | Notifications are in-app and token registration only; no browser push/wellness scheduling | Configurable reminders with supported-browser behavior, snooze/skip/disable, explicit permission |
| Medium | Existing schema/test docs contain pending inventories; architecture still mentions Expo | Update documentation from source; remove obsolete product claims |
| Medium | Large settings/form/endpoint modules, duplicate request schemas, legacy `any` suppressions | Incremental domain extraction and shared schemas; do not repeat unsafe patterns |
| Unmeasured | Responsive layout, accessibility, latency, query plans, bundle budget, real OCR accuracy | Gather current rendered/runtime evidence; do not infer quality from successful compilation |

## Implementation sequence and full-scope acceptance

Unchecked items remain in the goal, even where they require later iterations.

1. **Audit and safety foundation (sections 1–3, 17–18, 23, 29).**
   - [x] Read instructions, workspace plan, source architecture, routes, schema,
     core services, OCR pipeline, consumers, tests, and baseline reports.
   - [x] Record findings and preserve existing work.
   - [x] Scope financial retry keys and enforce vehicle/app/area ownership; verify
     real database isolation and aggregate integrity after rejected writes.
   - [x] Enforce driver account/session state and atomic refresh/reset consumption;
     remove reset-code logging and require actual email delivery outside tests.
   - [x] Isolate driver/admin query clients and driver persistence by account;
     prevent stale refresh results crossing account boundaries; replace shared
     service-worker API caching and add no-store response headers.
   - [ ] Fix owner isolation, retry identity, account revocation, upload/resource
     controls, error disclosure, cache privacy, CORS/security headers, and secrets.
   - [ ] Verify backup/restore, retention/deletion/export, audit history, and
     production environment configuration without exposing credentials.
2. **Market and provider research (sections 4, 6, 12).**
   - [ ] Document current official Egyptian Uber/inDrive/DiDi/Careem and delivery
     workflows, export/access limitations, private/motorcycle use, fuel/operating
     costs, and tax considerations. Do not assume integrations or uniform fees.
   - [ ] Compare browser/server/cloud OCR and document/vision extraction for mixed
     Arabic/English, cost, latency, privacy, availability, and replaceability.
   - [ ] Research fatigue, sitting, hydration, sleep, and breaks from reputable
     occupational-health sources; no medical diagnosis.
3. **Reliable capture (sections 5–10, 19, 27–29, 34).**
   - [ ] Provider-neutral image/document/recognition contracts; content decoding,
     rotation/crop/contrast and resolution handling; bounded resource use.
   - [ ] One/many trips across 1/5/20 screenshots, mixed days/platforms, repeated
     and overlapping documents; retain field/source evidence and uncertainty.
   - [ ] Deterministic units/time normalization and financial validation;
     duplicate protection before and during confirmation.
   - [ ] Attention-only bilingual review, raw-text/manual fallback, field
     corrections, one-tap confirmation, persisted batches, retry and drafts.
   - [ ] Fast manual entry with remembered choices, mobile keyboards, transparent
     calculations, recent values, and duplicate safeguards.
   - [ ] Representative consent-safe screenshot dataset: single/multiple,
     resolutions/compression/rotation/dark/partial/duplicates/overlap,
     Arabic/English/platforms/missing/ambiguous fields. Measure field and trip
     accuracy, false positives/negatives, deduplication, latency, and failure rate.
4. **Driver business and wellness (sections 11–12, 20–22).**
   - [ ] Complete expense/fuel/vehicle/mileage/service/license/insurance workflows,
     platform comparison and income/hour/km, fuel/km, commission/expense ratios.
   - [ ] Configurable wellness reminders/checklist/weekly summary; snooze, skip
     today, disable, frequency, permissions, fatigue awareness.
   - [ ] Weekly/monthly bilingual reports including all requested financial,
     platform, time, distance, vehicle, maintenance, wellness and comparison fields.
   - [ ] Configurable maintenance/license/report/spending/productivity summaries;
     privacy-conscious event collection and delivery evidence.
5. **Administration (sections 16, 18, 22, 30).**
   - [ ] Driver/Admin/Super Admin/Support responsibilities and server permissions.
   - [ ] Real defined metrics, timeframe/filter/comparison/drill-down for every
     requested user, usage, financial, OCR, support, health, latency and storage
     metric; geography only with sufficient privacy basis.
   - [ ] Complete users/drivers/vehicles/platforms/imports/support/complaints/audit/
     flags/notifications/reports operations; confirm dangerous actions.
6. **Experience and performance (sections 13–15, 19, 24–25, 28, 31).**
   - [ ] Coherent tokens, natural Egyptian Arabic/English, RTL/LTR, semantics,
     focus/keyboard/labels/contrast, touch targets, reduced motion.
   - [ ] Verify 320/360/375/390/414/430px plus tablet/laptop/desktop/large displays;
     upload/review/forms/tables/charts/dialogs/sticky and bottom navigation.
   - [ ] Loading/empty/error/success/validation/permission/offline states on every
     operation; clear recovery copy and data preservation on poor networks.
   - [ ] Measure and improve bundles, lazy views, image payload, queries/indexes,
     pagination, caching, SSR benefit, hydration if used, and subscription cleanup.
7. **Release evidence (sections 26–27, 32–35).**
   - [ ] Lint, typecheck, unit, service, business, API, integration, component,
     browser E2E, production builds, security and performance checks all current.
   - [ ] E2E covers all 20 named journeys: auth, vehicles, apps, manual trip,
     single/multiple uploads, multiple extraction, duplicates, correction, batch,
     finance, analytics, notification, report, admin, permissions, AR RTL, EN LTR,
     mobile, poor-network recovery.
   - [ ] Critically review changes and re-test identified edge cases. Verify the
     full Definition of Done per feature; successful builds alone are insufficient.
   - [ ] Final engineering report: inspected/changed/added, decisions/OCR,
     security/UX/performance, commands/results, external blockers and next steps.

## Research evidence

- OWASP API1:2023 Broken Object Level Authorization, retrieved 2026-09-17:
  <https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/>.
  Object IDs in request bodies and headers require authorization, not just route
  protection. This applies to related vehicle/app/area IDs and retry record lookup.
- Prisma transaction documentation, retrieved through Context7 2026-09-17:
  <https://www.prisma.io/docs/orm/prisma-client/queries/transactions>.
  Serializable transactions with bounded P2034 retries prevent write-conflict
  anomalies. Validate supported APIs against the installed Prisma 6 client.

## Verification log

- Initial `npm run lint`: passed on the inherited worktree.
- Initial typecheck passed. Initial API run: 196 passed, five health tests failed
  because the test booted the full application and exceeded its setup timeout.
- Service ownership checks, composite retry-key migration, and changed-payload
  conflicts implemented for trips/fuel/expenses/sessions. Real PostgreSQL 16
  isolation test passed, including batches, sync, uniqueness and aggregate checks.
- Health HTTP tests isolated from full application boot. Full integration still
  covers real database availability and startup/shutdown; it passed against a
  disposable local database with all nine migrations and repeatable seeds.
- Before dependency updates: API 201/201, frontend 18/18, shared packages 80/80,
  verification 585/585, all builds, contract catalog (161 routes/40 controllers,
  80 driver and 60 admin consumers), dependency boundaries and artifact isolation
  passed. The additional payload/transport unit tests passed 9/9.
- Security scanner false positives fixed with tests (13/13). Repository scan
  passed; no credentials were exposed in diagnostics.
- Production dependency audit initially reported 15 advisories. Reviewed security
  upgrades and overrides now produce zero advisories across the complete installed
  dependency graph, including development tooling.
- The first full patched root run passed all builds, integration, contract,
  boundary, route, artifact and security checks but failed smoke. Real auth errors
  exposed unregistered error codes; stale smoke expectations omitted idempotency
  headers and expected pre-envelope delete status. Both causes were corrected.
- Current focused evidence: API 225/225, driver web 15/15, admin 12/12, packages
  80/80, verification 589/589. Real database authentication checks passed, including
  access revocation and competing refresh/reset requests. These browser-client
  tests exercise transports/caches, not rendered browser journeys.
- A second root run exposed stale generated catalogs after adding tests. The
  runtime-consumer extractor now excludes test requests, with regression coverage.
  Two harmless expression patterns were clarified to satisfy the secret scanner
  without relaxing its checks. Contracts and repository security scan passed.
- Full root verification rerun: `2026-09-16T22-15-59-301Z-348` (UTC), log
  `verification-output/security-foundation-verify-3.log`; passed, including all 41
  smoke checks and the current integration/build/security checks.
  Evidence is diagnostic on this dirty worktree. Root E2E remains an old
  not-applicable placeholder and does not satisfy the full goal's E2E requirement.
- Build artifact measurement covers individual chunks; it does not prove that
  combined initial JavaScript meets the initial-load budget. Browser/performance
  and real OCR acceptance remain open.

See `security-foundation.md` for files, deployment implications, official dependency
release sources, and test scope. No browser, production OCR, or production readiness
claim is made.

### OCR capture checkpoint — 17 September 2026

- Replaced default cross-image merging with per-document capture, optional hints,
  per-candidate platform/source/confidence/raw text, partial failures and stable IDs.
- Added twenty-image limits, strict decoded-image checks, upload admission and
  bounded provider processing. Exact repeated images reuse OCR within a batch.
- Fixed Cairo local-to-UTC conversion, missing date/year handling, DST ambiguity,
  generic receipt subtotal misuse and absent commission defaults.
- Replaced fabricated batch-save values with validated editable review. Selection
  uses explicit vehicle/app choices and successful partial saves leave the retry
  set. The current page retains edits across dialog close/reopen.
- Added rendered Chromium tests and made them a blocking root verification step.
  Nine browser journeys passed, including Arabic RTL at 320/390/768/1280 pixels,
  twenty-image selection, partial retries, duplicate defaults and network failure.
  These use controlled API responses; they do not prove cloud accuracy or the
  complete database-backed product journey.
- Root verification `2026-09-16T22-51-03-898Z-10832` passed with real disposable
  PostgreSQL integration, 41 smoke checks, browser tests, builds and security gates.
  Detailed files, evidence and limitations: `ocr-capture-implementation.md`.
- Next capture work: persisted import/correction/source history, reload/offline
  recovery, saved-trip duplicate checks, and net-only financial representation.
  The complete product scope above remains active and unfinished.

### Persisted OCR jobs checkpoint — 17 September 2026

- Added driver-owned manifests and individually replayable image uploads, stored
  extraction evidence and progress/restore/list/cancel operations.
- PostgreSQL coordinates image reservations, fleet worker leases and fenced
  completions. Processing and cancellation release image bytes; upload and result
  retention have explicit deadlines. Processing never automatically creates trips.
- Real PostgreSQL tests cover cross-driver isolation, concurrent replay,
  duplicates, partial outcomes, restart recovery, stale completion, bounded retry,
  cancellation, expiry and resource admission. Contract and multipart tests cover
  the HTTP boundary. The provider is deterministic in these tests.
- Detailed changed files, design, limits and remaining integration:
  `ocr-import-recovery.md`. The browser still needs account-scoped durable drafts,
  the new job API and atomic confirmation/source history. Full product scope,
  real OCR acceptance and production operations remain unfinished.
- Root run `2026-09-16T23-17-00-143Z-22756` passed, including the new PostgreSQL
  recovery evidence, smoke, nine browser regressions, builds and security checks.
  Supplementary verification: 595/595 tests; final new-store restore and database
  isolation/authentication tests passed. This is a verified server checkpoint,
  not completion of the capture workflow or any other unfinished scope section.

### Durable review and atomic confirmation checkpoint — 17 September 2026

- Connected capture to persisted jobs. IndexedDB retains source files, stable retry
  keys, progress and invalid/edited review values per account. Quota failures are
  visible, reload resumes missing uploads, saved receipts recover lost responses,
  and logout/account change clears the local draft. A superseded synchronous
  client hook/transport and unused standalone review form were removed.
- Confirmation commits each trip, aggregates, source/correction snapshot and
  receipt atomically. Owner-scoped candidate identity survives reuploads, edits,
  trip deletion and batch expiry. Driver locking also prevents competing trip
  updates/deletes from applying stale aggregate changes.
- Required financial facts are validated before saving; conflicting fare,
  commission and received amounts are rejected. Pickup/destination, payment and
  waiting-fee breakdown persist in structured fields. Net-only records and broader
  financial arithmetic remain unfinished.
- Sixteen intercepted Chromium regressions passed: original review/RTL/partial
  save journeys plus full reloads, processing recovery, lost manifest/confirmation
  responses, storage failure, focus retention and logout cleanup.
- A separate browser journey passed against real Nest authentication, actual
  Sharp decoding, the scheduler/parser and PostgreSQL. It covers review edits,
  reload, confirmation and receipt recovery. Only cloud recognition is a fixture;
  the test does not establish OCR accuracy. This journey found and fixed Prisma
  Decimal vehicle serialization that blocked browser vehicle lookups.
- Real database confirmation tests cover races, rollback after trip/aggregate
  writes, references, partial failures, edits/deletes and historical receipts.
  Supplementary verification passed 597 tests. Detailed file inventory and limits:
  `ocr-import-recovery.md`.
- Next required capture/finance work: net-only representation and honest aggregate
  coverage, general correction audit history, duplicate review against existing
  trips, cross-device recovery, representative OCR accuracy/performance evidence.
  All 35 master sections remain in scope; no full feature or production-readiness
  completion is claimed by this checkpoint.
- The next financial audit identified nightly rollup double-counting, inconsistent
  commission/tip treatment across periods, and session concurrency/time semantics.
  Concrete evidence and acceptance sequence: `financial-integrity-audit.md`.
- Final root run `2026-09-17T00-03-58-693Z-23088` passed; log
  `verification-output/ocr-recovery-root-verify-3.log`. Includes 266 API tests,
  PostgreSQL migrations/isolation/auth/recovery/confirmation checks, 41 smoke
  checks, 16 intercepted browser tests plus one real API/database journey, builds,
  contracts, boundaries, routes, measurements and security. Reports are diagnostic
  on this dirty worktree. Earlier failures were fixed at their cause: a vehicle
  fixture omitted Prisma numeric types, and smoke checked today for a trip that
  started before midnight. Financial delta assertions remain intact.

### Financial reconciliation checkpoint — 17 September 2026

- Replaced incremental aggregate writers and nightly replay with source-derived
  replacement under a shared driver lock. Daily/weekly/monthly totals now agree
  on tips, commissions, trip toll/parking and operating costs. Exact integer
  rounding covers negative net, zero denominators and storage bounds.
- Working time unions overlapping trips and closed sessions and clips it to each
  reporting day. Fare/distance belong to the start day. Daily odometer records
  override summed trip distance and survive rebuilds; inconsistent paid distance
  rejects atomically with Arabic/English recovery guidance.
- Trip/fuel/expense/session/odometer edits and deletions coordinate with rebuilds.
  A partial unique database index enforces one open session. Admin trip deletion
  and restoration reconcile all projections and write audit history in the same
  transaction. Driver reads/edits exclude soft-deleted trips.
- Added a preview-first, resumable repair CLI for existing day and orphan period
  rows. The seed and legacy profit engine use the same calculation path. Fuel
  responses now serialize Prisma numerics through the shared contract.
- Real database tests cover repeated/corrupt rebuilds, concurrent partial edits,
  rollback, session and deletion races, midnight/month/ISO-year boundaries,
  driver isolation, odometer overrides, admin restoration and audit failures.
  A separate CLI check proved read-only preview and repeatable application.
- Full root run `2026-09-17T00-39-16-732Z-19928` passed; log
  `verification-output/finance-root-verify-2.log`. Includes 271 API tests, 98
  package tests, real PostgreSQL integration, 41 smoke checks, 17 intercepted
  browser regressions plus one real API/database browser journey, production
  builds, contract/boundary/route checks, artifact measurements and security.
  All 18 browser tests passed without skips or flakes. Supplementary verification
  passed 597/597; new browser tests also passed focused lint and final diff checks.
- The real browser journey verifies daily/weekly/monthly net after OCR
  confirmation, rejects an inconsistent odometer entry, and checks revised
  distance/profit-per-km. Recognition is still a deterministic provider fixture.
  Local service measurements with 1,000 synthetic trips and ten samples measured
  p95 rebuild 40 ms and write 51 ms; remote/network/concurrent load is unmeasured.
- No production database was migrated or repaired. Migration preflight,
  operational commands, changed-file inventory and financial semantics are in
  `financial-reconciliation.md`. Reports remain diagnostic on the dirty worktree.
- Next: net-only capture and honest aggregate coverage, Cairo business-day
  migration, cost linking/allocation, maintenance/fuel estimates and correction
  history. All other unfinished master sections remain in scope. This checkpoint
  does not establish complete financial correctness or production readiness.

### Take-home income checkpoint — 17 September 2026

- Added a shared financial-evidence resolver and income-mode enum. Manual/OCR
  capture supports take-home totals including tips while preserving unknown
  gross/commission. No platform-rate fee is invented. Notes-only edits preserve
  facts, included-tip edits preserve net-only totals, and later fare enrichment
  establishes the missing commission without double-counting tips.
- Prisma stores explicit earnings and nullable fare details. All five aggregate
  families carry availability counters; public gross totals become null when
  incomplete. Driver/admin reports explain coverage, and trip readers show
  take-home income. Reconciliation restores counters from source records.
- Preserved legacy OCR receipt layouts and tested net-only confirmation through
  concurrency, rollback, retries, edits, deletion and repeated imports. Review
  mode switching retains entered values; ambiguous extracted received amounts
  are not silently promoted to tips-inclusive income.
- Fixed HTTP retry serialization for database numerics and native dates. New
  tests prove exact saved-response replay and reject a reused key when only the
  trip time changes. Unknown money is never serialized as zero.
- Full root run `2026-09-17T01-15-19-823Z-22804` passed; log
  `verification-output/net-income-root-verify-2.log`. All migrations, PostgreSQL
  integration, API units, 104 package tests, 41 smoke checks, 19 browser tests,
  production builds, contract/boundary/route checks, measurements and security
  passed. Separately, 35 web unit tests and 597 supplementary checks passed.
  The 19 browser tests comprise 17 intercepted regressions and two real API/DB
  journeys, with no skips or flakes. Cloud recognition remains a provider fixture.
- The first full run exposed an invalid direct-write uniqueness fixture. It now
  supplies the commission established by its fare and received values; neither
  assertions nor database constraints were weakened. Focused database regressions
  passed before the full rerun. Final browser changes also passed focused lint.
- Changed-file inventory, income semantics, migration preflight, coordinated
  client/API release requirements, replay compatibility and rollback limits are
  recorded in `net-only-income.md`. Only disposable test databases were changed;
  the inherited dirty worktree makes verification reports diagnostic.
- Next: Cairo business-day allocation, cost linking/coverage and accurate
  comparison labels, maintenance/fuel models, and manual financial correction
  history. All other unfinished master sections remain in scope. This is a
  verified implementation checkpoint, not full product or production completion.

### Cairo reporting checkpoint — 17 September 2026

- Added shared Cairo date/clock helpers and actual DST day boundaries. Fare,
  distance and trip count use the start date; unioned work intervals span actual
  23/24/25-hour days. Costs, report windows, hour buckets, current goals/scores,
  digest and nightly schedules now use the Cairo calendar where appropriate.
- Added an explicit legacy-driver calendar marker. A cutover rebuilds all five
  projection families under the driver write lock before changing the marker.
  Source instants, manual date labels and existing estimates are preserved.
  Conflicts/timeout roll back completely; cross-driver reports wait until the
  legacy cutover is complete. The preview-first repair CLI exposes pending
  calendars and gives operational cutovers a longer bounded transaction timeout.
- Manual/OCR/expense local-time entry is independent of device timezone. Skipped
  times reject; repeated hours require an occurrence choice or preserve a known
  unchanged instant. Driver/admin formatting and date filters agree; open report
  queries refresh at Cairo midnight. Arabic/English report failures offer retry.
- Reused the Cairo formatter after measurement: the local 20-candidate time
  resolution benchmark improved from p95 29.8 ms to 3.5 ms. This is not a mobile
  interaction or production-load claim.
- Full root run `2026-09-17T01-51-17-596Z-22788` passed; log
  `verification-output/cairo-root-verify-2.log`. Includes 273 API units, 116
  package tests, real PostgreSQL integration, 41 smoke checks, all 21 browser
  tests (18 intercepted plus three real API/DB journeys), builds, contracts,
  boundaries, route audit, measurements and security. No browser skips/flakes.
  Separately, 42 web units and 597 supplementary checks passed.
- Fixed two failures discovered during validation: PostgreSQL session-zone
  conversion of bound instants, and a smoke fixture still sending a timestamp
  to the date-only report query. Financial assertions were retained, and smoke
  now rejects failed report reads instead of interpreting them as zero.
- Research sources, migration/rollback policy, changed-file inventory and test
  evidence are in `cairo-reporting-calendar.md`. Only disposable test databases
  were changed. OCR browser journeys still use a recognition-provider fixture.
- Next: `expense-integrity-audit.md` records cost-linking, complete expense
  summaries/pagination, comparison terminology, maintenance accounting and
  correction-history acceptance criteria. All remaining master sections stay
  in scope; this checkpoint does not complete the full product goal.

### Expense integrity checkpoint — 17 September 2026

- Expense totals now aggregate the complete Cairo month independently of cursor
  pages. Drivers can reach older records, edit with version checks, review
  financial snapshots, and delete/restore expenses in Arabic and English.
- Explicit toll/parking links count one payment on the expense date while
  retaining both source records. Ownership, category, amount, vehicle and active
  link uniqueness are checked under the driver lock. Updates reconcile old/new
  dates, weeks and months; platform/area/hour figures explain their limited
  operating-cost coverage. Driver trip deletion preserves linked source facts.
- Expense HTTP retries bind the record, payload and expected version. Lost
  responses replay without a duplicate; stale edits retain form input. OCR
  receipts recognize archived trips, and review edits mark the draft as saving
  before an older saved indicator can paint.
- Introduced contract major 2 with an exact breaking-operation manifest,
  prior/future-major rejection tests and a versioned driver query cache.
  ADR-0007 and `expense-integrity.md` describe the coordinated release and
  rollback constraints. The `/api/v1` route namespace remains unchanged.
- Full root run `2026-09-17T02-34-07-184Z-17396` passed; log
  `verification-output/expense-root-verify-2.log`. Includes all migrations,
  18 PostgreSQL integration checks, API units, 122 package tests, smoke,
  contracts, boundaries, builds, route audit, measurements and security.
  All 24 Playwright tests passed without skips/flakes (18 intercepted and six
  real API/DB cases). Separately, 46 web units, 12 admin units and 606
  supplementary checks passed. OCR cloud recognition is still a test fixture.
- The 1,003-row expense test verifies complete totals and tied-date paging after
  deletion of the cursor record. The focused local 20-sample summary/page p95
  was 4.92 ms over 1,002 active expenses; network and production load remain
  unmeasured. Tests also cover cross-week/month links, source moves, ownership,
  stale versions, history privacy, competing links and rollback.
- `maintenance-fuel-integrity-audit.md` records the next open accounting work:
  actual service payments versus estimates, service history and schedules,
  incomplete vehicle-cost assumptions and fuel-efficiency evidence. General
  financial correction history and the other unfinished master sections remain
  in scope. No production data or deployment was changed; the full goal remains
  active and has not received its final 35-section audit.

### Recorded maintenance cost checkpoint — 17 September 2026

- Active service costs now affect Cairo daily/weekly/monthly operating income.
  Explicit Other-expense links count a payment once on the active expense date;
  otherwise an active service cost uses its service date. Historical estimates
  remain visible separately. Zero-cost services are supported without inventing
  an amount when the entry field is blank.
- Service create/edit/archive/restore operations use driver locking, expected
  versions, scoped retries, ownership/applicability validation and append-only
  financial snapshots without notes. Source/projection/history changes and
  recommendation expiry share the transaction. Database constraints enforce
  owner links and one active service per expense.
- Projection version 2 atomically rebuilds existing driver reports, preserves
  legacy estimates and advances its marker only on success. Reports, goals,
  forecasts, current scores, newly generated recommendations/digests and admin
  totals use recorded costs. The unpublished major-2 release manifest explicitly
  includes the affected operations; ADR-0008 records the accounting decision.
- The driver can page, edit, review history, link, delete and restore in AR/EN.
  Unconfirmed saves retain retry identity; stale forms retain input. Missing
  service history stays unknown. One grouped query replaces per-item latest
  service queries, and generic catalog guidance no longer claims a confirmed
  vehicle schedule or mechanical condition.
- Root `2026-09-17T03-05-54-482Z-23244` passed: 19 PostgreSQL checks, API units,
  125 package tests, smoke, contracts, boundaries, all builds, route/security
  audits and artifact budgets. All 27 browser cases passed with no skips/flakes
  (18 intercepted, nine real API/DB). Separately: 48 driver units, 12 admin units,
  617 supplementary checks. Final AR/EN explanatory wording was followed by a
  successful driver build and artifact measurement. See
  `maintenance-cash-integrity.md` for file inventory and evidence limits.
- Open fuel work now also includes mixed-vehicle odometers in recommendations
  and the absence of a reachable purchase-entry screen. Confirmed per-vehicle
  schedules, fuel measurement/corrections, incomplete cost assumptions and the
  remaining master requirements stay open. No deployment or production database
  change occurred; the full goal has not received its 35-section acceptance audit.

### Fuel purchase checkpoint — 17 September 2026

- Added a reachable AR/EN fuel and charging workflow: payment-only entry,
  optional measured facts, explicit Other-expense links, complete filtered
  totals, cursor pages, correction history, versions, archive/restore and stable
  uncertain-save retries. Actual receipts stay independent of quantity × price.
- Full-to-full measurements exclude the opening fill and include intervening
  partial fills. Unknown fuel, gaps, missing quantities/boundaries, backwards
  readings, ties, mixed vehicles and mixed liquid-fuel families do not produce
  an unsupported estimate. Recommendations compare separate per-vehicle windows
  and carry actual cycle evidence rather than a diagnosis.
- Source/projection/history/mileage changes share the driver lock and transaction.
  Fuel and service records cannot claim the same active expense. Projection
  version 3 rebuilds linked/archive semantics atomically. Dated manual and fuel
  mileage retracts corrected sources; historical mileage remains unconfirmed
  rather than acquiring an invented origin. Settings do not resave a rounded
  old reading when editing unrelated fields.
- ADR-0009 and `fuel-integrity-checkpoint.md` describe the changed files,
  coordinated unpublished major-2 contract, migration, measurements and evidence.
  Final root `2026-09-17T03-52-12-964Z-23576` passed after explicit-UTC
  timestamp and display-precision corrections: 20 PostgreSQL checks, all API and
  package tests, 30 Playwright cases without skips/flakes, production builds,
  contracts, boundaries, route/security audits and artifact budgets. Separately,
  50 driver units, 12 admin units and 626 supplementary checks passed.
- Durable drafts across close/reload, historical manual-mileage audit, future
  reading activation, confirmed service schedules, vehicle-cost assumptions and
  remaining master sections stay open. No deployment or production migration
  occurred. The full goal remains active pending its complete 35-section audit.

### Operating-record draft checkpoint — 17 September 2026

- Expense, maintenance and fuel create/edit drafts now survive ordinary close,
  navigation and reload. Pending saves retain their body, UUID, account and
  original edit version before reaching the API. Resume is explicit; no
  background financial upload or automatic expiry of uncertain outcomes occurs.
- IndexedDB revision/generation checks reject stale tabs. Successful completion
  clears financial contents and retains a small tombstone; logout clears account
  drafts and late writes from signed-out tabs are rejected. Unreadable slots have
  scoped confirmation/recovery, and storage failure cannot silently submit an
  untracked payment. Resumed entries display their original vehicle.
- AR/EN device-save, pending, discard and conflict instructions explain the
  browser-storage limits. Form defaults and raw-draft schemas live in companion
  controls; linked amounts use read-only inputs to preserve submitted values.
  ADR-0010 and `operating-record-drafts-checkpoint.md` inventory the changes.
- Root `2026-09-17T04-24-19-597Z-9492` passed 20 PostgreSQL checks, all API/shared
  tests, 40 Playwright cases, builds, contracts, boundaries, route/security audits
  and 76 artifact measurements. Final display corrections passed another
  complete 22-case database browser run, focused Arabic/vehicle checks, web
  builds, lint, 57 driver units and refreshed security/artifact checks. All 630
  supplementary checks passed. Evidence is diagnostic for this uncommitted tree.
- The next inspected gap is manual trip recovery: its create identity is held
  only in component state, and trip updates lack optimistic versions and source
  revision history. `manual-trip-recovery-audit.md` records the findings and
  required acceptance work. All other unfinished master requirements remain
  active; no final 35-section audit, production change or deployment occurred.

### Manual trip recovery and correction checkpoint — 17 September 2026

- Manual trip creation/editing now uses account-scoped durable drafts, immutable
  pending payloads and stable retry identities. Successful-save cleanup retains
  the returned trip ID without another network write. Raw inputs and original
  edit versions survive navigation/reload; screenshot capture stays accessible
  when draft storage is unavailable.
- Trip writes require reviewed versions and record private-data-minimized
  financial history with source/version/actor metadata. Driver/admin deletion
  and restoration preserve aggregate, linked-fee and audit transaction integrity.
  Historical origin remains unconfirmed unless OCR confirmation evidence exists.
- Driver listing now pages across tied start times, exposes deleted records and
  permits restoration and correction-history review. Detail actions wait for a
  current fetch. Driver/admin batch selections retain the versions selected, and
  stale targets are reported instead of overwritten. Update/delete replay keys
  are bound to the resource and expected-version query where applicable.
- The coordinated unpublished major-2 manifest covers the eleven affected
  existing trip operations; history and driver restoration are new operations.
  Companion controls, shared types and existing React/Nest boundaries are kept.
  ADR-0011 and `manual-trip-recovery-checkpoint.md` record files and evidence.
- Root `2026-09-17T05-21-37-990Z-30664` passed all 21 PostgreSQL checks, 283 API
  tests, shared package tests, 41 smoke checks, 44 browser cases, builds,
  contracts, boundaries, route/security audits and 77 artifact measurements.
  The browser suites had no failures, skips or flakes. An initial dialog-focus
  race was fixed and the affected cases passed nine repeated checks before the
  full run. All 637 supplementary checks passed. Arabic history at 320 px was
  visually reviewed; automatic defaults create no empty manual draft and invalid
  amounts remain editable before pending-save persistence.
- `sync-correctness-audit.md` confirms that the legacy global pull cursor can
  advance beyond undelivered rows and lacks typed, complete delta semantics.
  ADR-0012 subsequently specifies and implements bounded reconciliation for pull.
  ADR-0013 subsequently addresses push semantics and session-end replay. The web
  app continues to use dedicated draft APIs; browser replication remains open.
  Other unfinished master requirements remain active.
