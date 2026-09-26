# Gemini receipt extraction

The production OCR adapter uses `@google/genai` with strict JSON response mode and
runtime schema validation. Azure OCR packages, clients, receipt helpers, and
configuration have been removed. Existing text parsers support deterministic
regression fixtures; Gemini output goes directly to the structured trip mapper.

## Configuration and model

Store `GEMINI_API_KEY` in the ignored `apps/api/.env`. `GEMINI_MODEL` defaults to
`gemini-3.5-flash`. Application startup does not require the key; extraction fails
with `OCR_AUTH` when it is absent. Test harnesses set `OCR_SUBSTITUTE_MODE=true`
and replace the recognition provider, preventing accidental live calls.

Google shut down Gemini 1.5 on September 29, 2025. The supported Gemini 3.5 Flash
model passed the representative image batch and is the configurable default.
Gemini 3.6 Flash reached the project's daily free-tier limit during the original
full-fixture attempt; its separate per-model quota does not prevent using the
remaining free quota on the selected model. Model listing alone does not establish
generation availability.

Sources checked September 18, 2026:

- https://ai.google.dev/gemini-api/docs/changelog
- https://ai.google.dev/gemini-api/docs/models
- https://ai.google.dev/gemini-api/docs/structured-output
- https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html
- https://googleapis.github.io/js-genai/release_docs/interfaces/types.HttpRetryOptions.html

## Extraction and financial meaning

`GeminiExtractionService.extractTrip(Buffer | string)` accepts image bytes or a
local file path and returns the requested exact per-trip model.
`extractDocument(Buffer | string)` returns `{ raw_text, trips }`, preserving every
visible trip on summary screenshots. The single-trip method rejects multiple
trips instead of discarding them. The HTTP adapter consumes prepared PNG bytes
without repeating image preprocessing.

The shared `ocrStructuredTripSchema` requires all fields, rejects extra keys,
checks finite numbers and real calendar dates, and allows null for missing values.
The provider receives the same field structure through `responseJsonSchema` with
`responseMimeType: "application/json"`. Text and candidate-count bounds are
enforced after generation: sending those bounds to the provider caused a 400
response during live verification.

The application maps EGP passenger fare to `grossEgp`, stated driver income to
`earningsEgp`, explicitly collected cash to `receivedEgp`, and commission to
`commissionEgp`. These are separate values. Foreign or missing currency does not
silently become EGP. All original fields, including trip ID, promotion, currency
and route, remain in candidate `evidence.extractions` and confirmation snapshots.
Merged screenshots retain every source extraction.

Missing years remain null. Complete local start times use the shared Cairo time
conversion; an end time is derived only when start and duration are available.
Visible trip distance fills paid distance; total driving distance including pickup
remains for review. Model confidence is self-reported and is not a calibrated
probability. Every Gemini candidate requires review before confirmation.

## Failure handling

Sharp verifies decoded format, dimensions, page count and pixel limits before
transmission. Gemini has a 60-second total abort deadline, a 25-second timeout per
attempt and at most two attempts. The SDK's independent retries are disabled.
Transient HTTP/network failures and malformed JSON/schema output can retry once;
authentication, invalid images and no-text results do not. Responses expose only
governed error codes, never provider diagnostics or credentials. Existing upload
limits, concurrency limits, per-image failure isolation and import recovery remain.

## Verification and examples

Run from the repository root:

```powershell
npm --workspace @ehsbha/api run test:ocr:live
```

The default run uses eight representative images, following the requested temporary
free-tier batch size of five to ten. `smoke:ocr` and `benchmark:ocr` use the same
batch. The script discovers every image recursively and validates the selected
images' exact trip schema, expected platform,
visible trip count, passenger fare, net earnings and cash collection, and requires fare or net earnings for each
trip. It prints filename/platform/fare/pass-fail and exits nonzero on failures,
missing fixture expectations or unprocessed selected images. It stops making
requests after authentication or quota errors and exits nonzero for an incomplete
batch. Reports distinguish the selected batch from the complete fixture inventory.

```powershell
# Inspect the selected images without API calls.
npm --workspace @ehsbha/api run test:ocr:live -- --list
# Optional full 22-image run when quota permits.
npm --workspace @ehsbha/api run test:ocr:live -- --all
```

The selected images cover DiDi cash receipts split across top/bottom screenshots,
DiDi electronic payments, two InDrive trips, a complete Uber receipt, a scrolled
Uber receipt, and a two-trip Uber earnings summary. Selection and the reason for
each case are recorded in the fixture manifest before live testing.
Requests are spaced by ten seconds by default; `GEMINI_FIXTURE_DELAY_MS` can change
that interval. The client also respects Google's retry delay when it fits within
the total request deadline. Pacing cannot overcome a daily quota.

`apps/api/test-fixtures/gemini-expectations.json` records image expectations.
The 22 supplied images include partial DiDi receipts, three two-trip Uber summaries,
four InDrive receipts and three Uber images stored in the DiDi folder. There is no
Careem image; Careem's schema and parser coverage is deterministic. Existing golden
files are preserved as historical parser evidence and contain financial/date
assumptions that differ from the new explicit extraction contract.

Timestamped reports under `verification-output/ocr-gemini/` contain the extracted
JSON examples, input hashes, model, timings, results and validation failures. They
are local, ignored artifacts because receipt text can contain personal data.
Passing these supplied fixtures does not measure accuracy on unseen screenshots.

## Verification evidence

The user accepted a representative batch of five to ten images in place of the
original full-fixture requirement. The final live run processed the same eight
preselected images, covering nine trips, with **8 passed, 0 failed and 0
unprocessed**. All schema, platform, trip count, fare, net income and cash checks
passed on Gemini 3.5 Flash.

- Completed: `2026-09-18T12:54:43.035Z`.
- Report: `verification-output/ocr-gemini/fixtures-1789736083036.json`.
- Log: `verification-output/gemini-representative-2.log`.
- Prompt SHA-256: `620bddeb726c50cec2030c6b00055daece0bb1f694177501bc9dc7c9a20201b8`.

The first representative run identified confusion between Uber and InDrive layouts
and a repeated commission deduction from a cropped DiDi income total. The final
prompt uses the platform's visible receipt labels and section boundaries. Expected
values and the selected images were preserved for the successful rerun.

Local repository verification passed in run `2026-09-18T12-34-03-494Z-14800`,
completed at `2026-09-18T12:43:55.839Z`: 27 PostgreSQL checks, 19 mocked browser
journeys, 43 browser journeys against the real API/database, HTTP smoke tests,
application builds, contract/boundary checks and security scans. After the batch,
model and prompt changes, all 195 OCR/mailer tests and the API plus fixture-runner
typecheck passed. The final API build, lint, 14 configuration/redaction tests and
security scan also passed. Logs: `verification-output/gemini-root-verify-1.log` and
`verification-output/gemini-batch-final-unit.log`. The deterministic gates use a
provider substitute; the separate eight-image report supplies live evidence.

Earlier failed full-fixture reports remain diagnostic history. All 22 images are
still available through `--all`, but full-fixture success is not claimed. The
representative batch stays within the requested five-to-ten-image scope; repeated
runs and retries still consume the project's available free quota.

## Example extracted from a supplied image

This is the actual structured trip returned for `didi/didi-AR-1.1.jpeg` in the
final Gemini 3.5 Flash report. The cropped screenshot does not show a date, route, trip
identifier or commission amount, so those values remain null.

```json
{
  "platform": "didi",
  "trip_id": null,
  "fare_details": {
    "total_fare": 24.4,
    "net_earnings": 20.96,
    "cash_collected": 20,
    "app_commission": null,
    "tip": null,
    "toll_fees": null,
    "discount_or_promo": 4.4,
    "currency": "EGP"
  },
  "trip_metrics": {
    "distance_km": 2.8,
    "duration_minutes": 9.03,
    "trip_date": null,
    "trip_time": null
  },
  "route": {
    "pickup_location": null,
    "dropoff_location": null
  },
  "confidence_score": 0.95
}
```

## Changed implementation areas

- `apps/api/src/modules/ocr/gemini/`: extraction service, SDK transport, provider,
  prompt/schema controls, typed document model, mapper, fixtures and unit tests.
- `packages/api-contracts/src/domains/ocr-structured.ts`, `ocr-capture.ts`, and
  `trip-ocr.ts`: exact structured trip contract and retained extraction evidence.
- OCR module/service/types, confirmation snapshots and screenshot merger: wire the
  provider and preserve financial meaning, sources and net earnings.
- `apps/api/scripts/gemini-fixtures.ts` and
  `apps/api/test-fixtures/gemini-expectations.json`: replace the old provider smoke
  and benchmark scripts with recursive live image validation.
- API package/lockfile, environment examples/schema, CI workflow and mailer mock:
  remove Azure dependencies and configure Gemini.
- Arabic/English review messages, admin configuration status, credential redaction
  checks and OCR documentation: reflect the provider and review behavior.
- Removed all files in the former `ocr/azure/` adapter and its unused chrome filter.
  Historical research and generic secret-redaction protections remain.
