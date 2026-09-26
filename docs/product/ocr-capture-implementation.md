# OCR capture implementation — 17 September 2026

This is an implementation checkpoint, not production OCR acceptance. The complete
product scope remains in `engineering-roadmap.md`.

## Capture and review

- Upload accepts twenty images, at most 5 MiB each and 40 MiB per batch. Invalid
  selections have explicit feedback. Preview object URLs are released on change
  and unmount; controls support keyboard input, RTL and 44-pixel touch targets.
- Automatic detection is the default. Platform/layout hints are optional. Each
  image receives its own platform and result; unknown platforms retain their raw
  text. Conflicting hints do not override a detected platform.
- Exact duplicate images reuse recognition within the request. Trip candidates
  carry stable IDs, document/hash/line references, field confidence, warnings and
  raw text. Conservative overlap matches remain visible and unselected.
- Failed images do not discard successful candidates. Too many candidates produce
  explicit failures on the affected documents, with text available for smaller
  retries. Explicit same-trip merges require compatible platform/timestamps and
  always require review.
- Cairo clocks use native IANA timezone rules, including summer time. Missing
  dates, missing years, ambiguous AM/PM, impossible dates, DST gaps and overlaps
  remain empty. Review preserves seconds rather than rounding to minutes.
- Generic receipt subtotal is not interpreted as driver earnings. Summary income
  does not fabricate gross fare or zero commission. Missing inDrive commission
  remains missing.
- Review validates money, times and distance before enabling selection. Drivers
  choose a vehicle when more than one is available; platform mapping requires an
  exact enabled match or an explicit app choice. Raw text and all required fields
  are available for correction. Edited values are identified as edits.
- Confirmation keeps candidate mutation IDs independent of upload order, selected
  position and request chunk boundaries. Successful cards are removed from the
  remaining selection after partial saves. Closing/reopening the dialog retains
  edits in the current mounted trip page.

## Backend boundaries and resources

The recognition abstraction carries structured trip evidence and a transcription. Gemini uses JSON schema response mode, followed by strict runtime validation. Requests have a 60-second total deadline and at most two attempts. Provider diagnostics are reduced to safe error codes. See `ocr-gemini-migration.md` for the current adapter and fixture evidence.

Sharp verifies decoded format, page count, dimensions and a 32-million-pixel cap
before transformation, then fully decodes with strict error handling. SVG content,
truncated payloads and pixel expansion beyond the cap are rejected.

Before multipart buffering, admission permits two concurrent uploads per API
process and one per driver, with twelve requests per driver per ten minutes. A
shared worker limiter permits two decoding/provider operations and forty queued
documents. These limits are per process; fleet-wide admission is still needed
before horizontal scaling. The endpoint remains synchronous, so the client
deadline accounts for the bounded queue. Persisted jobs and resumable upload are
still required in the browser for reliable long batches on poor networks. The
subsequent server-side job implementation is documented in
`ocr-import-recovery.md`; this synchronous route remains available during cutover.

OCR HTTP errors are registered in the shared error catalog. New candidate/document
contracts are additive, and the platform schema lives in a dependency leaf to
avoid a contract cycle. Existing React/Vite and NestJS feature boundaries are
preserved; no Angular migration was introduced.

## Files

- `packages/shared-types/src/zoned-time.ts` and tests: Cairo wall-clock conversion.
- `packages/api-contracts/src/domains/ocr-capture.ts`, `ocr-platform.ts`,
  `trip-ocr.ts`, and `core/errors.ts`: capture metadata, limits and governed errors.
- `apps/api/src/modules/ocr/`: orchestration, provider abstraction, admission,
  processing limit, recognition adapter, parser corrections and security/service tests.
- `apps/api/scripts/gemini-fixtures.ts`: live extraction and schema/fixture validation.
- `apps/web/src/components/ocr/`: upload, preview, optional source controls,
  configurable candidate review, confidence/edit display and failure recovery.
- `apps/web/src/lib/ocr/ocr-to-trip.ts` and tests: validated save conversion.
- `apps/web/src/pages/trips/trip-new.tsx`, OCR API client and hook: stable batch saves.
- Driver Arabic/English dictionaries: capture, errors, validation and review copy.
- `apps/web/tests/browser/`, `playwright.config.ts`, web Vitest config, package
  manifests and verification workflow: rendered browser tests and isolated runners.

## Evidence and limits

The first six Chromium journeys passed: automatic upload/partial save/stable retry,
missing-field validation/edit retention/Cairo display, and Arabic RTL review at
320, 390, 768 and 1280 pixels. Screenshots were inspected. These use intercepted
API responses and synthetic images; they validate the rendered workflow, not
cloud OCR accuracy or database-backed end-to-end confirmation. Additional tests
cover twenty-image selection, duplicate defaults, seconds and network failure.

API tests cover image decoding, independent mixed-platform extraction, exact image
deduplication, conservative overlap, bounded concurrency, failed documents, date
uncertainty, Cairo offsets, authenticated multipart limits and throttling. Driver
unit tests check that save conversion does not fabricate or clamp required facts.

Playwright is now a blocking root verification step; the former E2E placeholder
is removed. Install its runtime with `npx playwright install chromium`, then run
`npm run test:browser`. Its Vite server uses a dedicated loopback API target and
all API requests are intercepted. Production credentials are not used.

Persisted driver-owned import jobs, browser drafts and atomic confirmation are now
integrated; see `ocr-import-recovery.md` for current behavior, limits and evidence.
Remaining work includes duplicate detection against saved trips beyond exact
candidate identity, net-only financial records with honest aggregate coverage,
cross-device recovery, and the full product roadmap. The superseded standalone OCR
review form and synchronous client hook/transport have been removed after cutover.
Readiness scores are heuristic, not calibrated probabilities. Provider quality,
latency and false-ready rates require a redacted held-out screenshot dataset.

See `ocr-research.md` for provider research and acceptance criteria. The Google Gen AI SDK exposes abort signals, per-request timeouts and retry controls. Browser setup follows
https://playwright.dev/docs/test-webserver and https://playwright.dev/docs/mock.

## Verification checkpoint

Root run `2026-09-16T22-51-03-898Z-10832` passed. Log:
`verification-output/ocr-capture-verify.log`. It includes real PostgreSQL isolation
and authentication checks, all 41 smoke checks, all application builds, contracts,
dependency boundaries, security scanning and nine Chromium journeys. Browser
results: `verification-output/browser-report.json`, 9 expected, 0 failed, 0 skipped.
The report is diagnostic because the inherited worktree is dirty.

Focused verification also passed: 589 verification tests; 42 shared value tests;
47 contract tests; 28 driver client tests. API suite passed 262 tests before the
final candidate-limit regression was added; that OCR service suite then passed
15/15. The final precision/candidate-limit changes were checked after the root
run's earlier unit/typecheck stages. Full cloud extraction and database-backed
browser confirmation are not covered by the intercepted browser tests.
