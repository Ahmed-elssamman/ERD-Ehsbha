# Manual trip recovery audit — 17 September 2026

This audit captured the persistence/data-integrity gaps identified while verifying
operating-record drafts. Findings below describe the inspected pre-implementation
source. See `manual-trip-recovery-checkpoint.md` for the implementation and executed
acceptance evidence; the original findings are retained for traceability.

## Findings

- `apps/web/src/pages/trips/trip-form.tsx` creates `clientMutationId` with component
  state. Reload loses it and the form inputs. The form remains editable after an
  uncertain network result. Rebuilding a different body under an existing create
  identity can conflict; rebuilding the same entry under a new identity can
  duplicate a payment.
- `TripForm` resets from memoized defaults and has effects for vehicle/app
  defaults and commission calculations. Draft hydration must precede these
  effects, and pending saves must freeze them as well as the visible controls.
- `apps/api/src/modules/trips/trips.service.ts` already serializes writes with
  the driver lock, validates ownership, preserves financial evidence and updates
  aggregates atomically. Create identity is unique per driver and an existing
  identity is checked against submitted facts. Preserve these safeguards.
- The `Trip` model has no optimistic record version. Updates merge a submitted
  patch into the latest row under the lock, so a full form opened earlier can
  overwrite a later correction. Durable edit drafts require a captured version
  and server conflict enforcement before they can be enabled safely.
- Manual-trip updates and deletion do not append the versioned source history
  added for expenses, service records and fuel. OCR confirmation receipts are
  separate evidence and do not constitute a complete trip correction history.
- `TripForm` navigates to the returned trip ID after success. A draft completion
  failure needs to retain that receipt for local-cleanup retry; the operating
  record session's boolean completion result alone is insufficient for that
  navigation behavior.

## Acceptance work

Preserve incomplete manual-create inputs and selected platform/vehicle; keep a
pending payload and identity before network submission; resume explicitly after
reload; and retain a successful receipt while local cleanup retries. Maintain
the existing OCR capture/review/confirmation lifecycle independently.

Add optimistic correction/delete semantics and append-only source revisions
before resuming historical edit drafts. Cover linked trip fees, actual payment
dates, aggregate rollback, ownership, stale writers, immutable create identity,
soft deletion and already-confirmed OCR receipts. Update all affected shared
contracts/consumers and the unpublished major-2 manifest together.

Prove Arabic/English mobile entry, reload of incomplete and pending inputs,
first-attempt validation failures, lost successful responses, explicit retries,
account switching, two tabs, storage errors and stale edits. Preserve the
existing transparent take-home/breakdown financial model; do not manufacture
missing fares, commissions or distances as part of this persistence work.
