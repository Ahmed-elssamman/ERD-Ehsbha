# Wellness and notification audit — 17 September 2026

Inspected during work-session verification, then expanded during wellness work.
[ADR-0015](../adr/0015-wellness-and-work-indicators.md) records the subsequent
implementation. The inbox, preferences, and existing digest producer are addressed
by [ADR-0016](../adr/0016-notification-delivery-and-digest-evidence.md); the findings
below describe the inspected baseline. Browser push and additional maintenance,
license, and report producers remain open. Current evidence belongs in the
[notification checkpoint](notification-delivery-checkpoint.md).

- `ScoreService.compute` always supplies `fatigueScore: 0`. The score engine still
  derives a field named safety from that value and late-night trip share. This is
  not evidence of a driver's health or driving safety.
- `RecommendationsService.computeCurrentFatigue` guesses `sleepGapHours` from
  gaps between recorded sessions. Gaps are not observed sleep. With one session,
  its current maximum-gap calculation becomes zero; missing records do not
  justify either zero or twenty-four hours of sleep. Its continuous-trip interval
  can also remain nonzero long after the last recorded trip ended.
- The fatigue formula's weights and SAFE/TIRED/HIGH thresholds have arithmetic
  unit tests, not clinical validation. The high result generates a definitive
  fatigue label and a fixed thirty-minute instruction. Replace unsupported
  inference with factual recorded-work information and researched, configurable,
  non-diagnostic guidance. Preserve useful break awareness without presenting a
  calculated health/safety assessment.
- The original recommendation reader includes deleted trips/sessions, sums
  overlapping sessions, and filters by start time rather than clipping overlapping
  intervals to the rolling day/week. The work-session checkpoint corrects this
  reader through `recorded-workload.ts` and real PostgreSQL cases. Broader fatigue
  semantics were subsequently replaced in the wellness checkpoint; the fatigue
  consumer and its unused rolling reader are now retired. Historical work-session
  checkpoint evidence describes the earlier revision.
- Correction to the initial audit: a later full inspection found a local check-in
  embedded in `driver-score.tsx`. It uses one unscoped localStorage key for sleep,
  symptoms, stress and other answers, silently ignores save failure, supplies
  invented defaults, and computes a second unvalidated fatigue percentage. The
  guide's wellness-adjusted safety wording reflects that implementation; it is
  still an unsupported assessment. Replace it with account-scoped optional
  reminders, a checklist with unrecorded defaults, and explicit storage failures.
- Notifications currently have an in-app list, manual digest generation, and
  arbitrary device-token registration. No PushManager subscription, notification
  permission request, service-worker push handler, or configurable wellness
  scheduler was found in the inspected application sources. Do not promise
  delivery while the PWA is closed based on token storage alone.
- The notification screen requests fifty records without exposing continuation,
  ignores read errors when deriving its empty state, and its mark-all action acts
  only on the loaded unread records. It needs truthful scope, paging, and visible
  mutation/read recovery as part of notification work.

Next acceptance work includes reputable fatigue/sleep/sitting/hydration sources,
clear limits of recorded activity, configurable frequency, snooze, skip today,
disable, browser permission and delivery constraints, account isolation, quiet
hours, non-spammy delivery, and an actual daily checklist/weekly summary. Test
Arabic/English, mobile, reload, offline/poor connectivity, permission denial,
multiple tabs/devices, Cairo midnight/DST, and historical data without inventing
health facts or claiming delivery guarantees unsupported by the browser.

## Sources retrieved for the next implementation

Retrieved 17 September 2026; these sources establish guidance and platform
constraints, not validation of the existing fatigue formula.

- [UK Highway Code, rule 91](https://www.gov.uk/guidance/the-highway-code/rules-for-drivers-and-motorcyclists-89-to-102):
  advises adequate sleep, not starting a journey when tired, planning breaks,
  and stopping somewhere safe when sleepy. It recommends a break of at least
  fifteen minutes after two hours of driving. This is UK guidance, not an
  Egyptian legal work/rest limit or proof that a given driver is safe to drive.
- [NHS water, drinks and hydration](https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/water-drinks-nutrition/):
  water is a useful hydration choice; other drinks and food contribute fluid.
  Its six-to-eight-cup guidance is explicitly a guide with varying needs.
  Do not turn this into an individualized prescription or infer dehydration.
- [NHS benefits of exercise](https://www.nhs.uk/live-well/exercise/exercise-health-benefits/):
  recommends reducing prolonged sedentary time alongside physical activity.
  The older sitting-specific URL redirected here. General advice can support
  optional movement reminders when safely stopped, not disease predictions.
- [MDN using the Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API):
  permission should follow a user gesture; secure-context restrictions apply.
  Mobile implementations should use a service worker's `showNotification`
  rather than assuming the desktop notification constructor works.
- [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API):
  browsers throttle background timers and normally stop animation callbacks.
  Reminder scheduling must use persisted due instants and visibility recovery,
  without promising exact background delivery from a page timer.

The CDC/NIOSH and NHTSA pages attempted in this environment returned access-denied
responses and were not counted as retrieved evidence. Successful source extracts
are stored locally under `verification-output/wellness-source-*.txt` for review.

## Notification follow-up after wellness

The current wellness implementation uses an optional local foreground channel.
The separate server inbox still needs these changes, verified by reading its
service/controller/page and daily-digest scheduler during the final wellness gate:

- Replace duplicated request schemas with the shared contracts; bound tokens and
  cursors, and use stable `sentAt/id` ordering with owner-scoped cursor validation.
- Preserve the first read timestamp under retries. Add governed not-found errors
  and truthful client mutation recovery. Expose continuation and make a bulk-read
  action explicitly apply to the displayed selection, or implement an atomic
  server cutoff operation with a clearly stated scope.
- Add persisted notification category preferences for actual supported producers,
  with daily-digest opt-out and quiet/frequency controls. Do not expose switches
  for unimplemented delivery channels. The current cron scans all active drivers
  and has no user preference check.
- Give generated notifications a database-enforced business-date/event identity
  so concurrent manual triggers and scheduled runs cannot duplicate delivery.
  Batch scheduled driver scans instead of loading every driver in one query.
- Inventory existing device-token users before replacing the endpoint. Upserting
  an arbitrary token currently reassigns its user and is not a Web Push
  subscription/permission/delivery implementation. Browser push needs its real
  permission, subscription, service worker and server delivery lifecycle, with
  explicit recovery for denial, expiration and unsupported platforms.
- Connect real maintenance/report producers and preserve their evidence and
  timestamps. Weekly/monthly report delivery remains open; local wellness
  checklist counts are not automatically present in server reports.
- `generateForDriver` currently calls `buildArabicPayload` for every driver,
  without reading the driver's locale. The inbox displays its stored title even
  in English. Use localized structured message keys or the actual recipient
  locale, and test both languages.
- Manual/scheduled daily digests currently always create a new notification once
  insights exist; there is no existing deduplication check to preserve. Verify
  per-day identity on real concurrent requests.
- Recheck financial labels in digest insights: best-hour/app/area candidates are
  computed from trip take-home earnings, whereas the monthly goal and yesterday
  totals read operating-net aggregates. Distinguish those measures rather than
  describing every trip-derived value as net operating profit.

Acceptance must include tied timestamps, foreign/stale cursors, repeated reads,
partial failures, locale changes, disabled preferences, concurrent scheduler
claims, Cairo day boundaries, offline retry, mobile/keyboard access and truthful
permission/delivery states. These are remaining implementation tasks, not external
blockers or evidence of completion.
