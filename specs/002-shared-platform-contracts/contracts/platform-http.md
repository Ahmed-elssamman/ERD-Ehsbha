# Platform HTTP Contract

## Version Profile

- Public API path version: `v1`
- Initial shared contract version: `1.0.0`
- Supported client compatibility: contract major version `1`
- Initial migration: coordinated API, driver web, and admin web deployment
- Later additive response fields: compatible within major version `1`
- Changed required fields, meanings, units, pagination semantics, or error semantics:
  incompatible and require an approved migration plan

## Response Headers

Every API response includes:

```text
X-Request-Id: <privacy-safe request identifier>
X-Api-Version: v1
X-Contract-Version: 1.0.0
```

`Retry-After` is included when a governed throttling or temporary in-progress outcome has a known
retry interval.

## Success Envelope

```json
{
  "data": {},
  "meta": {
    "requestId": "4c2558e2-6796-4e66-91f8-bf15332c1115",
    "serverTime": "2026-06-11T12:00:00.000Z",
    "apiVersion": "v1",
    "contractVersion": "1.0.0"
  }
}
```

Rules:

- `data` is validated by the operation's success schema before use by a client.
- Required known fields must be present and valid.
- Unknown response fields are preserved and ignored by consumers.
- `meta` is required for JSON responses.
- Empty successful operations use an explicit operation schema such as `{ "ok": true }`; they do
  not silently omit `data`.

## Failure Envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "messageKey": "errors.validation",
    "details": [
      {
        "path": "limit",
        "code": "too_big",
        "message": "Must be less than or equal to 100"
      }
    ]
  },
  "meta": {
    "requestId": "4c2558e2-6796-4e66-91f8-bf15332c1115",
    "serverTime": "2026-06-11T12:00:00.000Z",
    "apiVersion": "v1",
    "contractVersion": "1.0.0"
  }
}
```

Rules:

- Error codes come from the governed error catalog.
- `message` is a sanitized fallback, not raw framework, Prisma, provider, or stack text.
- `messageKey` is optional and selected by the application locale.
- `details` is present only when the code's registered detail schema permits it.
- Request identifiers contain no credentials or personal data.

## Request Validation

- Path, query, header, and JSON body objects reject unknown fields.
- Multipart binary file fields use explicit upload rules; accompanying text fields remain strict.
- Authentication, authorization, ownership, and abuse controls remain API responsibilities and
  are not implied by schema validity.
- JSON content limits remain bounded by API configuration.
- Date-time inputs require an unambiguous offset and normalize to UTC.
- Money, distance, and duration use integer minor/base units.

## Contract Version Mismatch

Clients compare `contractVersion` with their supported major version before processing operation
data.

When unsupported:

1. Reject the response body as operation data.
2. Preserve `requestId`, received version, and expected range in the normalized diagnostic error.
3. Surface `CONTRACT_VERSION_MISMATCH`.
4. Do not retry automatically.
5. Do not clear authentication solely because of the mismatch.

## Pagination

### Cursor request

```json
{
  "cursor": "opaque-value",
  "limit": 25
}
```

### Cursor response data

```json
{
  "items": [],
  "page": {
    "mode": "cursor",
    "limit": 25,
    "nextCursor": null,
    "hasMore": false
  }
}
```

### Offset response data

```json
{
  "items": [],
  "page": {
    "mode": "offset",
    "limit": 25,
    "offset": 0,
    "total": 0,
    "hasMore": false
  }
}
```

Rules:

- Default limit is 25.
- Maximum limit is 100 unless the catalog records an approved exception.
- Cursor values are opaque and bound to the operation, realm, normalized filters, and stable sort.
- Empty pages are valid and include complete page metadata.
- Invalid, expired, or cross-filter cursors produce `INVALID_CURSOR`.

## Idempotent Writes

Retryable duplicate-sensitive operations declare:

```text
Idempotency-Key: <8-128 character stable key>
```

Rules:

- Scope is realm, authenticated actor, operation, and key.
- The API hashes the canonical validated request, not raw JSON property order.
- Same key and same hash after completion returns the original status and response.
- Same key and different hash returns `IDEMPOTENCY_KEY_REUSED` with HTTP 409.
- Same key while the first request is executing returns `IDEMPOTENCY_IN_PROGRESS` with HTTP 409.
- Generic replay storage excludes credentials, tokens, MFA material, raw images, and private
  provider payloads.
- Default replay retention is 24 hours.

## Client Retry Profile

Safe reads may retry at most twice for:

- Network failure before a response is received
- HTTP 408
- HTTP 429, respecting `Retry-After`
- HTTP 502
- HTTP 503
- HTTP 504

Automatic retry is prohibited for validation, authentication, authorization, not-found,
deterministic conflict, contract mismatch, and non-idempotent writes.
