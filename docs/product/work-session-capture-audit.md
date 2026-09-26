# Work-session capture audit — 17 September 2026

Inspected while the sync-push checkpoint was under verification. The historical
findings below motivated [ADR-0014](../adr/0014-recorded-work-sessions.md) and the
[work-session capture checkpoint](work-session-capture-checkpoint.md). Current
implementation and verification status belongs to that checkpoint.

- `apps/web/src/pages/dashboard/dashboard.tsx` displays `onlineMinutes` and
  profit/hour, but its hours action navigates to `/best-hours`. No actual session
  start/end transport methods or capture flow were found in the driver browser;
  `session.submit` matches belong to local record drafts.
- `aggregate-calculation.ts` computes the union of trip and completed-session
  intervals, clipped to the reporting day. This avoids overlapping time being
  counted twice. Without recorded sessions, waiting/idle work outside trips is
  absent, so the displayed time is recorded time rather than proof of a complete
  shift. A future capture flow and labels must make this distinction clear.
- The current session model requires one `driverAppId` and permits only one
  open session per driver. Aggregates attribute each session to that app as well
  as the driver's total. A driver can use several platforms during one shift;
  silently assigning an entire multi-app shift to an arbitrary default app would
  corrupt app comparisons. Decide overall-shift versus platform-session semantics
  explicitly before adding a generic start-work button. Preserve existing
  app-attributed history and the total-time union.
- Session list is capped at 100 with only `startedAt` ordering and no continuation.
  The shared `sessionSchema` also makes several real record fields optional.
  A history/correction workflow needs bounded stable paging, complete contracts,
  owner checks, and a reviewed correction policy rather than relying on this cap.
- `SessionsService.getOpen` returns null when no session is open. The global
  response interceptor converts null into `{ ok: true }`, but the current open
  operation advertises `sessionSchema`, which requires a session ID. Define and
  test an explicit nullable open-session response before a client depends on it;
  a successful HTTP status alone does not establish a valid empty state.
- Open-session reads are owner scoped. Session start stores its creation identity;
  ADR-0013 adds atomic session-end receipts. A browser flow must durably retain
  the action's identity and intended timestamp before sending, handle lost replies
  and stale tabs, fetch current state before choosing start/end, and preserve
  account isolation. A delayed request should not replace the driver's intended
  end time with a later network-recovery time.
- Sessions have a seven-day maximum recorded interval. A driver who forgot to end
  one needs an explicit review of the actual end time; a timer must not silently
  interpret an abandoned open session as continuous work or medical evidence.

Acceptance needs an actual mobile Arabic/English start-work/end-work journey,
recovery after reload/poor connectivity, concurrent tabs/devices, cross-midnight
and Cairo clock changes, long-abandoned sessions, and verified financial/time
effects. Wellness reminders must remain configurable and non-diagnostic. A generic
sync client is not a substitute for this driver-facing workflow.
