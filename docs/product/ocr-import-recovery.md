# Persisted OCR imports and confirmation

Date: 17 September 2026. The driver capture dialog now uses persisted import jobs,
account-scoped IndexedDB drafts, and transactional confirmation with source history.
This is not a production OCR accuracy or complete capture-readiness claim.

## Behavior

An authenticated driver creates a manifest with a UUID retry key, optional parsing
hints and up to twenty SHA-256/size/MIME entries. The API returns a durable import
ID without waiting for OCR. Each unique image is then uploaded separately. A lost
response can be retried using the same manifest key and image bytes. A changed
manifest using that key conflicts; another driver's key is a separate scope.

Six governed API operations are registered:

| Method | Path under `/api/v1` | Purpose |
| --- | --- | --- |
| POST | `/ocr/imports` | Create or replay a manifest |
| GET | `/ocr/imports` | List recent owned imports; cursor pages default/cap at 25 |
| GET | `/ocr/imports/:id` | Restore progress and terminal extraction evidence |
| POST | `/ocr/imports/:id/images/:imageId` | Upload one image, at most 5 MiB |
| DELETE | `/ocr/imports/:id` | Cancel and erase retained image/extraction content |
| POST | `/ocr/imports/:id/confirm` | Save reviewed candidates and return durable receipts |

All operations enforce ownership on the server. Upload authorization runs before
Multer buffers the file. The server verifies the declared hash, byte length and
MIME, then the existing Sharp processor verifies decoded content before OCR.
Repeated hashes within a manifest reference the original image and are processed
once. The public response never includes stored image bytes or original filenames.

## Execution and storage

The existing Nest scheduler drives a PostgreSQL-backed queue, with no additional
queue or object-storage dependency. Transaction-scoped advisory locking serializes
admission and lease changes across API processes. The database clock determines
lease deadlines. Network/provider work runs outside transactions.

- At most two unexpired worker leases across the import subsystem.
- At most 200 pending unique images and 256 MiB of reserved source-image bytes.
- Three unfinished imports and twelve new manifests per hour per driver.
- Two active multipart uploads per process, one per driver, and 200 upload
  attempts per driver per ten minutes per process; enough for whole batches and
  response-loss retries without letting replays evade all HTTP admission.
- Ninety-second leases; a new lease token fences out a late previous worker.
- At most three processing attempts. Only transient failures retry automatically,
  with a short increasing delay. Permanent image errors finish immediately.
- Source images and unused reservations expire after 24 hours. Terminal processing
  releases source bytes immediately. Extraction evidence expires after seven days.
- Cancellation erases image payloads, extraction JSON and batch result JSON in one
  transaction. A minimal cancellation receipt remains until the seven-day expiry
  so a replay cannot recreate the cancelled job. Account deletion cascades to jobs.

The existing synchronous endpoint retains its separate per-process limits for
compatibility; the driver capture dialog has moved to imports. Not every possible
OCR request is governed by the database queue. Provider execution is at least once across crashes;
no trip is created by the worker. Fleet leases are coordination, not a provider
billing guarantee after a process failure.

The source quota bounds pending image bytes, not all PostgreSQL storage. Operators
must still monitor database/evidence growth, backups, retention-job health and
encrypted storage. These operational controls are part of the full project scope.

## Evidence handling

Each image stores the provider-independent document extraction. Assembly copies
that evidence before applying batch candidate limits, optional same-trip merge or
duplicate annotations. Overloaded documents retain safe raw text and fail before
large candidate records are persisted. Successful documents survive other image
failures. Terminal assembly is committed with the last document acknowledgement.

Cancellation, expiry and lease-token checks prevent late completions from restoring
erased evidence. Source identity is checked again before accepting a completion.
No trip or consent for model training is inferred from merely having extraction
evidence. Explicit confirmation is required.

## Confirmation and review recovery

Confirmation accepts at most twenty candidates. Each trip, aggregate update,
source/correction snapshot and acknowledgement commits in one transaction. A
driver row lock also serializes manual trip changes and deletion, so competing
updates cannot subtract stale values from aggregates. Invalid references reject
only their candidate; successfully committed candidates are acknowledged separately.

The `(driverId, candidateId)` receipt is stable across batches. Matching retries
return the original acknowledgement; incompatible values conflict. Deleting a trip
leaves a receipt that identifies its deletion, preventing a delayed retry from
recreating it. Expired batches leave privacy-limited history with their batch link
cleared. Initial history retains normalized source fields, confidence, source IDs,
warnings and corrections, but omits screenshot bytes and raw OCR text. It is not
a general audit log for later manual edits, and is not a training dataset.

Confirmed trips store pickup, destination, payment method and optional waiting-fee
breakdown as structured fields. Waiting fees are included in gross, not added again.
Required gross/commission and optional received values must agree. Net-only trips
still require the financial model extension described in the roadmap; this change
does not fabricate the missing fare or commission.

IndexedDB retains one active capture per signed-in account: original File objects,
the manifest UUID, batch ID, result, review values (including invalid input), choices
and selection. Review writes do not rewrite blobs. Sources and metadata are initially
written atomically; quota/storage failures remain visible with a retry action while
online capture can continue. This warning means reload recovery is not guaranteed.

Reload restores the draft and checks server acknowledgements before enabling save.
Interrupted uploads resume through the same manifest key and only missing image
uploads; a processing job continues on the server when the browser closes. The
driver explicitly resumes waiting/uploading after reopening. Closing the dialog
keeps the draft; starting a new capture clears it. Pending jobs are cancelled first.
Expiry and cancellation produce localized recovery errors. Failed image retries
retain only the failed sources after successful candidates have been saved.

Local drafts expire after seven days and clear on logout/account change. Source
files therefore may remain locally longer than the server's 24-hour source limit.
Browser storage eviction, private browsing and device loss can prevent local
recovery. Server recent-import listing exists; a cross-device recovery picker is
still outstanding. Arbitrary offline trip confirmation is not implemented.

The review dialog keeps keyboard focus during draft writes and uses unique labelled
dialog IDs. Acknowledged candidates are excluded from later saves, including when
the confirmation response was lost.

## Files

- `apps/api/prisma/schema.prisma` and
  `apps/api/prisma/migrations/20260917110000_durable_ocr_imports/migration.sql`:
  driver-owned batches, images, retry identity and queue indexes.
- `packages/api-contracts/src/domains/ocr-import.ts` and its tests, domain exports
  and governed errors: manifests, progress, pagination and operation contracts.
- `apps/api/src/modules/ocr/imports/`: controller, upload guard, transactional
  store, scheduler worker, mapping, models, limits and multipart boundary tests.
- `apps/api/src/modules/ocr/ocr.service.ts` and `ocr.module.ts`: reusable document
  extraction/assembly, per-document candidate bound and import module wiring.
- `apps/api/scripts/verify-ocr-imports.ts`, `test-driver-isolation.ts`,
  `test-integration.ts` and `scripts/verification/verify.mjs`: real-database
  recovery checks required by the root gate.
- `scripts/contracts/catalog-data.mjs`: inventory now includes 167 routes across
  41 controllers. Driver dictionaries add Arabic and English expiry/cancellation
  recovery messages.

- `20260917130000_ocr_confirmation_history/migration.sql`, shared
  `ocr-confirmation.ts`/`trip-details.ts`, confirmation service/mapper, trip write
  locking and `verify-ocr-confirmations.ts`: atomic saves and historical receipts.
- Driver `use-ocr-capture.ts`, `ocr-capture-store.ts`, `ocr-import-session.ts`,
  `ocr-imports.api.ts`, candidate review/upload dialog, trip creation/details,
  query-provider logout cleanup and both dictionaries: durable review workflow.
- `vehicle-response.mapper.ts` and vehicle controller: serialize Prisma fuel
  efficiency decimals as contract-compliant numbers for vehicle lookups.
- `apps/web/tests/browser-integration/`, `apps/api/scripts/browser-ocr-server.ts`
  and `playwright.integration.config.ts`: real browser/API/database journey, with
  only the external recognition provider replaced by a deterministic fixture.

Both additive OCR migrations have been applied only to the disposable local test
database. Production rollout requires them before the new API build.

## Validation

The PostgreSQL harness uses real transactions, constraints, parser/assembly and
worker execution with a deterministic provider and fixture image processor. It
does not contact Azure. The separate existing Sharp tests cover actual decoding.

Covered: concurrent manifest replay; changed-key conflict; cross-driver read,
upload, cancellation and cursor denial; duplicate source reservations; lost
upload response replay; shared worker limit; partial outcomes; no automatic trip
creation; restored results; lease recovery and stale acknowledgements; completion
source mismatch; cancellation; bounded transient retries; source/evidence expiry;
driver pending limits; global source-storage capacity; account cascade cleanup.

HTTP tests cover authentication/ownership before multipart processing, twenty
individual uploads plus replay, and rejection of additional files/fields. Contract
tests cover sizes, hashes, allowed MIME, manifest totals, duplicate metadata,
strict requests and bounded list queries. Sixteen intercepted browser regressions
now use the persisted-job wire contracts and cover reload, lost create/confirm
responses, partial saves, quota failures, keyboard focus and logout cleanup. These
are not a substitute for the separate real API journey or cloud accuracy testing.

The real browser journey passed against PostgreSQL, including actual login,
decoded PNG upload, persisted review edits, reload, confirmation, trip amounts and
Cairo instants, and receipt recovery after another reload. Only external recognition
is a fixture. Run `npm run test:browser:integration` with the disposable test
environment configured; the fixture requires `NODE_ENV=test` and a database name
starting with `ehsbha_test_`. Only test-example settings were used. Browser traces are
disabled for this suite so login tokens are not copied into trace archives.

The PostgreSQL confirmation harness covers concurrent confirmation, rollback after
trip/aggregate creation, ownership, inactive references, partial outcomes, changed
replays, corrections, competing manual edits/deletes, cross-batch receipts and
history surviving deletion. No actual provider credentials are needed.

Earlier server checkpoint: root run `2026-09-16T23-17-00-143Z-22756` passed;
log `verification-output/ocr-imports-verify-2.log`. This includes disposable
PostgreSQL migrations/recovery, all smoke checks, nine Chromium regressions,
production builds, contracts, boundaries, artifact measurement and security scan.
The report remains diagnostic because the inherited worktree is dirty.

That checkpoint's supplementary verification suite passed 595/595 tests after replacing its
fixed domain list with discovery from actual contract exports. New response schemas
preserve additive fields as required by the existing platform contract. The final
database harness also passed with a newly constructed store restoring the saved
result (`verification-output/ocr-imports-database-final.log`). The provider remains
a fixture; lease abandonment is simulated, not an actual cloud-provider outage.

That checkpoint's first root attempt exposed stale route counts and a scanner false positive on
an inferred UUID variable. Counts were updated and the variable received an
explicit string type; secret-scanning rules were not relaxed. Pagination follows
the platform default of 25. All six additional operation contract checks pass.

## Current verification checkpoint

Current confirmation/recovery checkpoint: root run
`2026-09-17T00-03-58-693Z-23088` passed. Log:
`verification-output/ocr-recovery-root-verify-3.log`. This includes 266 API tests,
shared package checks, real PostgreSQL migrations/isolation/auth/import/confirmation
checks, all 41 smoke checks, sixteen intercepted Chromium regressions and one real
API/database browser journey, all production builds, contracts, boundaries,
route/artifact checks and security scan. Both browser reports have zero failures,
skips or flaky tests. Supplementary verification passed 597/597 tests.

The first current root attempt exposed a vehicle HTTP fixture that used wire
numbers instead of Prisma Decimal/BigInt; it now tests actual serialization and
fractional efficiency. The second hit midnight UTC: the smoke trip started on the
previous date while the assertion read today's aggregate. All three smoke
aggregate assertions now read the trip's explicit date; the expected 8,500-piastre
increase and deletion reversal pass. No financial assertion was removed.

Evidence remains diagnostic on the inherited dirty worktree. Migrations were
applied only to the disposable local database; no production deployment occurred.
Cloud recognition accuracy, general financial correctness and full product
readiness remain separate acceptance requirements.

## Remaining work

1. Net-only financial representation with explicit aggregate coverage, and a
   comprehensive audit trail for subsequent trip corrections/deletion.
2. Duplicate review against saved trips beyond exact candidate identity, and
   cross-device recovery from recent server imports.
3. Expand real API browser coverage for disconnects, partial saves and every other
   required product journey. Benchmark large batches and browser storage behavior.
4. Representative consent-safe screenshot acceptance and measured provider
   accuracy/latency, plus the remaining complete product roadmap (all 35 sections).
