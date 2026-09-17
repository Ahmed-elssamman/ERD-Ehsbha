# Operating-record device drafts — 17 September 2026

This is one checkpoint under the complete 35-section master objective. It is
not a release attestation or a claim that all offline/product work is complete.

## Behavior

Expense, service and fuel/charging create/edit forms preserve incomplete values
and explicit payment links across close, navigation and reload. Each page offers
resume independently of its current server filter. Edits retain their original
record version. Pending requests retain their exact body and UUID before the
network request, remain read-only, and require an explicit retry.

Two tabs cannot overwrite a shared draft. Account generation and persisted
account checks prevent a signed-out tab from recreating local financial data.
Storage failure retains mounted inputs and blocks submission until device
storage recovers. Unreadable drafts have scoped, explicitly confirmed recovery.
AR/EN copy explains device storage, pending saves, discard and logout. Empty
expense amounts now start blank; linked expense/service amounts remain readable
by form validation while protected from editing. Resumed vehicle-bound entries
show their original vehicle even when the page currently selects another one.

## Files changed or created

- `apps/web/src/lib/record-drafts/record-draft.model.ts`: typed states, schemas,
  generations, errors and list metadata.
- `apps/web/src/lib/record-drafts/record-draft-store.ts`: account checks,
  transactional reads/writes, revision comparison, scoped recovery and cleanup.
- `apps/web/src/lib/record-drafts/record-draft-session.ts`: ordered saves,
  pending request identity, completion and retry transitions.
- `apps/web/src/lib/record-drafts/record-draft-session.spec.ts`: failure and
  replay invariants.
- `apps/web/src/components/record-drafts/record-draft-gate.tsx`,
  `record-draft-list.tsx`, `record-draft-notice.tsx`, `record-draft.control.ts`:
  loading, resume, status, conflict and deliberate discard UI.
- `apps/web/src/hooks/use-record-draft-form.ts`: form subscriptions and unload
  protection while the latest changes are not committed.
- `apps/web/src/pages/expenses/expense-draft.control.ts`,
  `apps/web/src/pages/maintenance/maintenance-draft.control.ts`,
  `apps/web/src/pages/fuel/fuel-draft.control.ts`: feature context/body/raw-field
  validation and companion form defaults.
- The three corresponding pages and record dialogs; expense form control;
  `apps/web/src/providers/query-provider.tsx`; `apps/web/src/i18n/ar.json` and
  `en.json`; the vehicle-label helper and expense history labels.
- `apps/web/tests/browser-integration/record-draft-fixtures.ts` and
  `record-drafts.spec.ts`; the maintenance and expense journeys' linked-amount
  assertions; `scripts/verification/verify.mjs` gives the expanded database
  browser suite a bounded five-minute window rather than killing it at two.
- ADR-0010, this checkpoint, the engineering roadmap and the previous fuel
  checkpoint's follow-up links; `manual-trip-recovery-audit.md` records the next
  inspected persistence/versioning gap.

React hooks and external companion controls follow the established workspace
architecture. The shared session/storage layer handles transport durability;
feature adapters retain their own form and API contracts. No backend API/schema migration,
new dependency, production change or commit is introduced by this checkpoint.

## Verification

Full root run `2026-09-17T04-24-19-597Z-9492` passed: lint, workspace types,
API unit tests, 20 real PostgreSQL integration checks, shared package tests and
builds, contracts, boundaries, smoke, route/security audits, production builds
and all 76 artifact measurements. The 40 Playwright cases comprised 18
intercepted cases and 22 real API/database cases, including HTTP-only checks;
there were no skips, unexpected failures or flakes. The database browser suite
took 127 seconds, explaining the required increase from its old 120-second
runner cap. Individual test timeouts and product/API budgets were retained.

After that gate, final vehicle-label translations and stale-draft instructions
passed another complete 22-case database browser run, web production build,
lint, 57 driver unit tests and artifact measurement. A final correction removing
the expense field's misleading "optional" wording from required vehicle
headings was checked with the Arabic and original-vehicle journeys and another
web build. Settled screenshots were visually reviewed at 320px. The shared
storage/session implementation was unchanged during these display corrections.

Separately, all 630 supplementary checks passed; the 22 runner/workflow checks
were repeated successfully after adjusting the browser-suite timeout. The
first root attempt correctly failed on an outdated disabled-field assertion
and the short suite timeout; those failures were corrected rather than skipped.

Logs/artifacts in `verification-output/`:

- `drafts-root-verify-2.log` and
  `runs/2026-09-17T04-24-19-597Z-9492/` — full gate and scoped evidence.
- `drafts-final-browser.log` — all 22 database browser cases after display fixes.
- `drafts-final-label-browser.log` — final Arabic/vehicle-label checks.
- `drafts-final-web-build-2.log`, `drafts-final-units.log`,
  `drafts-supplementary.log`, `drafts-runner-check.log` — additional validation.
- `drafts-final-lint-3.log`, `drafts-final-measure-2.log`,
  `drafts-final-security.log` — checks after the last label correction.
- `operating-draft-ar-320.png`, `operating-draft-notice-ar-320.png` — final
  Arabic entry and device-draft notice at a 320px viewport.

Evidence is diagnostic for the uncommitted worktree, not a production release
attestation. Only disposable local databases were used. The latest generic
`browser-integration-report.json` is from the two focused final checks; the
complete 22-case run is preserved in `drafts-final-browser.log` and the full
root report records its preceding complete browser run.

## Continuing master scope

Manual-trip draft/sync recovery, manual-mileage history and future reading
activation, vehicle cost assumptions, confirmed maintenance schedules and the
other unfinished master requirements remain active. Browser storage is not a
backup and unavailable device storage currently blocks these financial saves.
Archive/restore dialogs retain their existing version/idempotency behavior;
this checkpoint persists create/edit requests only. Full completion still
requires the requirement-by-requirement 35-section audit.
