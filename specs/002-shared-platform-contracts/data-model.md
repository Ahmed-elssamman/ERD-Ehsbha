# Data Model: Shared Platform Foundation and API Contracts

This phase primarily defines executable protocol metadata. Existing product records remain
authoritative. The only new persisted entity is the idempotency ledger required to replay
duplicate writes safely.

## ContractDefinition

Authoritative executable definition for one exchanged shape.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Stable kebab-case identifier, unique in the catalog |
| `kind` | enum | `request`, `success-data`, `failure`, `event`, or `shared-value` |
| `schema` | Zod schema | Runtime executable; no framework or persistence imports |
| `description` | string | Maintained contributor-facing purpose |
| `compatibility` | enum | `additive-compatible`, `behaviorally-changed`, or `incompatible` |
| `sinceVersion` | semantic version | First contract version containing the definition |
| `deprecatedSince` | semantic version or null | Requires replacement and removal plan when set |

### Validation

- Request object schemas are strict and reject unknown fields.
- Response object schemas validate known fields and preserve unknown additive fields.
- Public definitions cannot contain credentials, stack traces, Prisma records, provider payloads,
  or private operational fields.
- Identifiers and unit-bearing values use shared primitives where substitution creates risk.

## ContractCatalogEntry

Inventory and ownership record for one operation.

| Field | Type | Rules |
|---|---|---|
| `operationId` | string | Unique `<realm>.<domain>.<action>` identifier |
| `transport` | enum | `http` or `event` |
| `method` | HTTP method or null | Required for HTTP |
| `path` | string or null | Canonical `/api/v1/...` route for HTTP |
| `realm` | enum | `public`, `driver`, `admin`, or `system` |
| `lifecycle` | enum | `active`, `scaffold`, `obsolete`, or `inactive` |
| `request` | schema references | Path, query, headers, body, or event payload |
| `successData` | schema reference | Data inside the success envelope |
| `failureCodes` | error code references | All documented public failures |
| `pagination` | descriptor reference or null | Required for paginated lists |
| `idempotency` | policy or null | Required for retryable duplicate-sensitive writes |
| `consumers` | list of ConsumerBinding | API producer and active web/admin consumers |
| `compatibility` | enum | Impact class for the current definition |
| `owner` | string | Domain or phase owner |
| `followUp` | string or null | Required for non-active lifecycle states |

### Relationships

- References one or more `ContractDefinition` records.
- References zero or one `PaginationDescriptor`.
- References zero or one `IdempotencyPolicy`.
- References one or more `ErrorCodeDefinition` records.
- Owns one or more `ConsumerBinding` records for active operations.

### Validation

- Every active extracted API route has exactly one active catalog entry.
- Every active client call maps to one catalog entry and one declared consumer.
- Scaffold, obsolete, and inactive entries require owner and follow-up.
- An HTTP method/path pair is unique.
- Active operations cannot reference deprecated definitions without an approved migration.

## ConsumerBinding

Connects an operation to a producer or consumer.

| Field | Type | Rules |
|---|---|---|
| `application` | enum | `api`, `web`, `admin`, or `external` |
| `sourcePath` | repository path | Must exist for repository consumers |
| `role` | enum | `producer`, `consumer`, or `documentation` |
| `migrationStatus` | enum | `local`, `migrating`, `shared`, or `excluded` |
| `localDefinitionPaths` | string array | Must be empty when status is `shared` |
| `owner` | string | Required |
| `followUp` | string or null | Required for `excluded` |

## ResponseMeta

Metadata present in every JSON success and failure response.

| Field | Type | Rules |
|---|---|---|
| `requestId` | string | 16-128 privacy-safe characters; generated when inbound value is invalid |
| `serverTime` | ISO-8601 UTC instant | Includes `Z` or explicit UTC offset |
| `apiVersion` | string | Current public API path generation, initially `v1` |
| `contractVersion` | semantic version | Initially `1.0.0` |

The same request ID is emitted in the response header and structured diagnostic record.

## SuccessEnvelope

| Field | Type | Rules |
|---|---|---|
| `data` | operation success schema | Required; may be null only when operation contract allows |
| `meta` | ResponseMeta | Required |

Known fields are validated. Unknown additive response fields are preserved for compatibility.

## FailureEnvelope

| Field | Type | Rules |
|---|---|---|
| `error.code` | ErrorCode | Required stable machine code |
| `error.message` | string | Required safe fallback, never raw framework/provider text |
| `error.messageKey` | string or null | Stable localization key when user-visible |
| `error.details` | FieldIssue array or approved detail schema | Optional and code-specific |
| `meta` | ResponseMeta | Required |

## FieldIssue

| Field | Type | Rules |
|---|---|---|
| `path` | string | Dot/bracket path with no sensitive values |
| `code` | string | Stable validation issue code |
| `message` | string | Safe developer/user fallback |
| `messageKey` | string or null | Optional localization key |

## ErrorCodeDefinition

| Field | Type | Rules |
|---|---|---|
| `code` | uppercase string | Globally unique |
| `httpStatus` | integer | 400-599 |
| `category` | enum | validation, authentication, authorization, not-found, conflict, throttling, transient, contract, or internal |
| `retryPolicy` | enum | `never`, `safe-read`, `retry-after`, or `idempotent-write` |
| `messageKey` | string or null | Required for user-visible stable outcomes |
| `detailsSchema` | schema reference or null | Only approved safe details |
| `realms` | realm array | At least one |

## PaginationDescriptor

| Field | Type | Rules |
|---|---|---|
| `mode` | enum | `cursor` or `offset` |
| `defaultSize` | integer | 25 |
| `maximumSize` | integer | 100 unless approved exception is recorded |
| `stableSort` | ordered field list | Must include a unique tie-breaker |
| `filterBinding` | boolean | Cursor mode must be true |
| `emptyPageBehavior` | enum | Valid empty result with complete metadata |
| `exceptionOwner` | string or null | Required when maximum differs from 100 |
| `exceptionReason` | string or null | Required when maximum differs from 100 |

Cursor values are opaque and bind operation, normalized filters, sort, realm, and continuation
position. Invalid or cross-query cursors return a governed validation code.

## SharedValueType

| Type | Representation | Validation |
|---|---|---|
| Money | integer piastres | Safe integer; operation-specific non-negative/range rules |
| Distance | integer meters | Safe integer; operation-specific non-negative/range rules |
| Duration | integer seconds | Safe integer; operation-specific non-negative/range rules |
| Instant | ISO-8601 UTC string | Offset required; normalized to UTC |
| Calendar date | `YYYY-MM-DD` string | Real calendar date |
| Locale | `ar` or `en` | No presentation behavior in shared package |
| Timezone | IANA timezone string | Validated at boundary |
| Identifier | branded non-empty string | Brand distinguishes material domains and realms |

## ClientDataRule

| Field | Type | Rules |
|---|---|---|
| `operationId` | string | Catalog reference |
| `queryKey` | tuple template | Stable and serializable |
| `safeRead` | boolean | Controls automatic retry eligibility |
| `maximumRetries` | integer | 0 or 2 under the platform policy |
| `transientCodes` | error code array | Must match error catalog |
| `invalidates` | query key templates | Required for successful writes |
| `idempotencyRequired` | boolean | Must match operation policy |
| `sessionOutcomes` | normalized outcomes | Realm-specific handling |

## BoundaryRule

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique rule ID |
| `from` | package/application pattern | Required |
| `to` | package/application pattern | Required |
| `allow` | boolean | False for forbidden dependency |
| `appliesTo` | enum array | source, alias, dynamic, transitive, artifact |
| `message` | string | Names the boundary and remediation |
| `fixture` | repository path | Controlled pass/fail evidence |

## IdempotencyPolicy

| Field | Type | Rules |
|---|---|---|
| `header` | string | `Idempotency-Key` |
| `minimumKeyLength` | integer | 8 |
| `maximumKeyLength` | integer | 128 |
| `scope` | tuple | realm, actor ID, operation ID, key |
| `payloadHash` | string | SHA-256 of canonical validated request |
| `retentionHours` | integer | Default 24; operation may document a longer value |
| `replayableStatuses` | status classes/codes | Successful and deterministic completed outcomes only |

## IdempotencyRecord (Persisted)

| Field | Type | Database rules |
|---|---|---|
| `id` | string | Primary key |
| `realm` | string | Driver/admin/system classification |
| `actorId` | string | Authenticated subject; never inferred from request body |
| `operationId` | string | Catalog operation identifier |
| `key` | string | 8-128 characters |
| `requestHash` | string | 64 lowercase hex characters |
| `status` | enum | `IN_PROGRESS`, `COMPLETED`, or `RETRYABLE_FAILURE` |
| `responseStatus` | integer or null | Required when completed |
| `responseBody` | JSON or null | Bounded, approved replay body; no credentials |
| `resourceType` | string or null | Optional diagnostic ownership |
| `resourceId` | string or null | Optional result identity |
| `createdAt` | timestamp | UTC |
| `completedAt` | timestamp or null | UTC |
| `expiresAt` | timestamp | Indexed for cleanup |

### Constraints and indexes

- Unique: `(realm, actorId, operationId, key)`.
- Index: `(expiresAt)`.
- Index: `(actorId, createdAt desc)`.
- `COMPLETED` requires response status, body, and completion time.
- `IN_PROGRESS` cannot contain a replay response.
- Replay payload size is bounded by configuration and tested.

### State transitions

```text
absent
  -> IN_PROGRESS
      -> COMPLETED
      -> RETRYABLE_FAILURE

same key + same hash + COMPLETED
  -> replay stored result

same key + same hash + IN_PROGRESS
  -> IDEMPOTENCY_IN_PROGRESS

same key + different hash
  -> IDEMPOTENCY_KEY_REUSED

RETRYABLE_FAILURE or expired record
  -> operation may claim a new IN_PROGRESS attempt
```

Validation, authentication, authorization, and ownership checks occur before the record is
claimed. Token and credential operations do not store replay payloads in this generic table.
