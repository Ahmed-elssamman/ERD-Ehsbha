# OCR provider research and capture design

Initial sources retrieved 2026-09-17. This is a research/design record, not an
accuracy benchmark or a provider availability guarantee.

## Verified capabilities

| Option | Evidence and fit | Remaining evaluation |
| --- | --- | --- |
| Existing Azure Read adapter | Microsoft documents printed Arabic, mixed languages, word/line positions and confidence. The repository already normalizes these outputs and has four platform parsers. | Accuracy on existing image fixtures and unseen Egyptian screenshots; current SKU/region availability, request limits, cost, retention and latency under the configured account |
| Azure Document Intelligence Read | Microsoft positions it for text-heavy scanned/digital documents with an asynchronous API. Existing code instead optionally calls `prebuilt-receipt`, which must not be assumed to understand ride-hailing earnings summaries. | Compare Read/layout evidence with the current receipt model; do not pay for a second request without a measured benefit |
| Tesseract.js | Official documentation supports browser and Node execution and reusable workers across multiple images. This can keep recognition local once models/runtime assets are installed. | Arabic/English screenshot quality, model download size, mobile memory/CPU/battery, low-end-device latency and confidence calibration. Recognition alone does not provide trip semantics |
| Amazon Textract | Its official limits page lists English/French/German/Italian/Portuguese/Spanish detection; Arabic is absent. | Excluded as the primary recognizer for this bilingual product on current documented language support |
| Other cloud/document/vision engines | Not yet evaluated against current official documentation and a representative dataset. | Cost, structured-output reliability, privacy/legal basis, regions, field accuracy, uncertainty, rate limits, lock-in; no invented comparison numbers |

Sources:

- <https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview-ocr>
- <https://docs.aws.amazon.com/textract/latest/dg/limits-document.html>
- <https://github.com/naptha/tesseract.js/blob/master/README.md>

Keep the working Azure integration during capture repairs, behind a domain-owned
recognition interface. Provider selection remains provisional until comparison
evidence supports a change. Do not install a second OCR runtime solely because it
is available. Neither high OCR word confidence nor a model's self-reported score
proves that a fare, time, or trip boundary was interpreted correctly.

## Pipeline requirements for implementation

1. Validate actual file bytes/format and dimensions, then normalize orientation
   and resolution with explicit memory/pixel/file-count/total-byte limits. Bound
   provider concurrency. Preserve independent image failures and retry only them.
2. Record a document content hash and image index before recognition. Exact
   duplicates reuse recognition within a batch. An image hash is not a trip ID.
3. Produce provider-neutral text lines/words/boxes/confidence. Preserve text for
   the driver's fallback review; do not log it or send it to analytics.
4. Detect platform per document; allow a user hint to be corrected. Unknown
   platforms must remain unknown rather than silently selecting Uber.
5. Segment per platform/layout, preserving date headers and card source ranges.
   Keep multi-screen details of one trip separate from multiple-trip summaries.
   Never merge distinct trips simply because they arrived in one request.
6. Extract candidate fields with source references, field confidence and warnings.
   Keep visible driver earnings distinct from rider payment and gross fare.
7. Normalize Arabic/Persian/Western digits, decimal/currency/distance/duration, and
   Cairo local dates/times. Missing year/AM-PM/date stays uncertain; don't assume
   afternoon, UTC, today, zero commission, or a fictitious duration.
8. Match duplicates conservatively using platform, evidenced time, source trip ID
   when visible, amount semantics and route/distance corroboration. A repeated
   screenshot is definitive; equal fares alone are not. Persist import identity
   independently of file order and UI selection index.
9. Validate candidate completeness, field ranges, financial relationships and
   cross-field consistency. Only fully evidenced, valid candidates can be ready
   without driver attention. Highlight precisely the uncertain fields.
10. Persist a driver-scoped import batch and confirmation state. Confirm valid
    selected candidates idempotently, report outcomes per candidate, preserve
    corrections and source provenance, and update financial aggregates atomically.
    Recovered retries must not save duplicates or hide partial failures.
11. Provide a bilingual mobile review with ready/review/duplicate/failed counts,
    manual/raw-text correction and save/retry. Never select the first vehicle/app
    as an unnoticed substitute for a missing choice. Keep local drafts account
    scoped and recoverable after connectivity failure.

## Acceptance dataset

Existing material includes JPEG fixtures for Uber, DiDi and inDrive, golden JSON,
text fixtures including Careem, and historical benchmark results. Historical
outputs are not proof for the new pipeline. Before cloud evaluation, confirm that
fixtures are redacted and suitable for the configured provider's privacy policy.

Add and label single/multiple-trip images, 5/20-image batches, mixed platforms and
days, exact/recompressed duplicates, overlapping cards, small/large resolution,
rotation, dark/partial/compressed images, Arabic/English/mixed scripts, missing
fields, ambiguous AM/PM/year and payments that do not reconcile arithmetically.
Separate development fixtures from held-out acceptance cases.

Report per-platform field accuracy, trip detection precision/recall, false ready
candidates, duplicate precision/recall, failed document rate, and latency
distribution. Also test corrected/manual fallback and network retry. No
production-readiness claim is justified until these measures and the complete
driver journey pass on the current implementation.
